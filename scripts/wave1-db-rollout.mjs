import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createPublicClient, http, erc20Abi, decodeFunctionData, parseEventLogs, parseUnits } from "viem";
const mode = process.argv[2] || "check";
if (!["check", "apply"].includes(mode)) throw new Error("Use check or apply.");
const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }, log: [] });
const rpc = createPublicClient({ transport: http("https://rpc.test.mezo.org", { timeout: 15_000, retryCount: 1 }) });
const token = "0x118917a40faf1cd7a13db0ef56c86de7973ac503";
const report = { mode, checkedAt: new Date().toISOString(), receiptsPreserved: false };
const additions = { users: ["businessName"], payments: ["mode", "chainId", "token"], payment_requests: ["intendedPayerAddress", "merchantName", "version", "settlementKey"], faucet_claims: [] };
async function snapshot(client) {
  const result = {};
  for (const [table, omit] of Object.entries(additions)) {
    result[table] = await client.$queryRawUnsafe(`SELECT to_jsonb(t) - ARRAY[${omit.map(name => `'${name}'`).join(",")}]::text[] AS row FROM "${table}" t ORDER BY id`);
  }
  return result;
}
try {
  const before = await snapshot(db);
  report.counts = Object.fromEntries(Object.entries(before).map(([table, rows]) => [table, rows.length]));
  // Never infer legacy-vault ownership from a missing hash. Only positively
  // verified direct receipts receive DIRECT; all other history is unclassified.
  const candidates = await db.$queryRaw`SELECT p.id, p."paymentId", p.amount::text, coalesce(p."recipientAddress",r."walletAddress") AS recipient, s."walletAddress" AS sender FROM payments p JOIN users s ON s.id=p."senderId" LEFT JOIN users r ON r.id=p."recipientId" WHERE lower(p."paymentId")=lower(p."payoutTxHash") AND p."destChain"='MEZO'`;
  if (await rpc.getChainId() !== 31611) throw new Error("Wrong chain");
  const verified = [];
  let unreadableHistoricalDirect = 0;
  for (const candidate of candidates) {
    let tx, receipt;
    try { [tx, receipt] = await Promise.all([rpc.getTransaction({ hash: candidate.paymentId }), rpc.getTransactionReceipt({ hash: candidate.paymentId })]); }
    catch { unreadableHistoricalDirect++; continue; }
    const call = decodeFunctionData({ abi: erc20Abi, data: tx.input });
    const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter(log => log.address.toLowerCase() === token) });
    if (receipt.status !== "success" || tx.from.toLowerCase() !== candidate.sender || tx.to?.toLowerCase() !== token || tx.value !== 0n || call.functionName !== "transfer" || call.args[0].toLowerCase() !== candidate.recipient || call.args[1] !== parseUnits(candidate.amount, 18) || !logs.some(log => log.args.from.toLowerCase() === candidate.sender && log.args.to.toLowerCase() === candidate.recipient && log.args.value === parseUnits(candidate.amount, 18))) throw new Error("Historical direct receipt mismatch");
    verified.push(candidate.id);
  }
  report.verifiedHistoricalDirect = verified.length;
  report.unreadableHistoricalDirect = unreadableHistoricalDirect;
  const statements = (await readFile(new URL("../prisma/sql/2026-11-01-wave1.sql", import.meta.url), "utf8")).split(/^-- statement\s*$/m).map(part => part.trim()).filter(Boolean);
  if (mode === "apply") {
    const backupDir = new URL("../.wave1-backups/", import.meta.url); await mkdir(backupDir, { recursive: true, mode: 0o700 });
    await writeFile(new URL(`history-${Date.now()}.json`, backupDir), JSON.stringify(before, null, 2), { mode: 0o600 });
    await db.$transaction(async client => {
      await client.$executeRawUnsafe('LOCK TABLE users, payments, payment_requests, faucet_claims IN ACCESS EXCLUSIVE MODE');
      if (!isDeepStrictEqual(before, await snapshot(client))) throw new Error("History changed during backup; rerun");
      for (const statement of statements) await client.$executeRawUnsafe(statement);
      for (const id of verified) await client.$executeRaw`UPDATE payments SET mode='DIRECT', "chainId"=31611, token=${token} WHERE id=${id} AND mode='UNCLASSIFIED'`;
      if (!isDeepStrictEqual(before, await snapshot(client))) throw new Error("Original history changed; rolled back");
    }, { timeout: 30_000 });
    report.applied = true; report.receiptsPreserved = true;
  }
  await writeFile(new URL("../docs/evidence/wave1-db-rollout.json", import.meta.url), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report));
} catch (error) { console.error(JSON.stringify({ failed: true, errorClass: error.name, code: error.code ?? null })); process.exitCode=1; }
finally { await db.$disconnect(); }
