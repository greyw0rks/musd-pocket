import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

const mode = process.argv[2] ?? "check";
if (!["check", "apply"].includes(mode)) throw new Error("Use check or apply.");
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!/^postgres(?:ql)?:\/\//.test(url ?? "")) {
  throw new Error("Configure a PostgreSQL DIRECT_URL or DATABASE_URL.");
}
const db = new PrismaClient({ datasources: { db: { url } } });
const report = new URL("../docs/evidence/faucet-production-rollout.json", import.meta.url);
const migration = await readFile(new URL("../prisma/sql/2026-10-31-faucet-round-v2.sql", import.meta.url), "utf8");
const originalColumns = '"id", "userId", "walletAddress", "btcTxHash", "musdTxHash", "error", "claimingAt", "completedAt", "createdAt", "updatedAt"';
const readRows = client => client.$queryRawUnsafe(`SELECT ${originalColumns} FROM "faucet_claims" ORDER BY "id"`);

try {
  const columns = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'faucet_claims'`;
  const indexes = await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'faucet_claims' ORDER BY indexname`;
  const before = await readRows(db);
  console.log(JSON.stringify({ mode, claimRecords: before.length, hasRound: columns.some(row => row.column_name === "round"), indexes: indexes.map(row => row.indexname) }));
  if (mode === "apply") {
    const backupDir = new URL("../.faucet-backups/", import.meta.url);
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const backup = new URL(`claims-${Date.now()}.json`, backupDir);
    const completeRows = await db.$queryRawUnsafe('SELECT * FROM "faucet_claims" ORDER BY "id"');
    await writeFile(backup, JSON.stringify(completeRows, null, 2) + "\n", { mode: 0o600 });
    await db.$transaction(async tx => {
      // Lock out claim writers while validating that the migration preserves every row.
      await tx.$executeRawUnsafe('LOCK TABLE "faucet_claims" IN ACCESS EXCLUSIVE MODE');
      const lockedRows = await readRows(tx);
      if (!isDeepStrictEqual(lockedRows, before)) throw new Error("Claim activity changed during the backup; rerun rollout.");
      for (const statement of migration.replace(/^--.*$/gm, "").split(";").map(part => part.trim()).filter(Boolean)) {
        if (statement === "BEGIN" || statement === "COMMIT") continue;
        await tx.$executeRawUnsafe(statement);
      }
      const after = await readRows(tx);
      if (!isDeepStrictEqual(before, after)) throw new Error("Original claim records changed; migration rolled back.");
    }, { timeout: 30_000 });
    const rounds = await db.$queryRaw`SELECT round, count(*)::int AS claims FROM "faucet_claims" GROUP BY round ORDER BY round`;
    const verification = { applied: true, oldReceiptsPreserved: true, claimRecords: before.length, rounds, activeRound: "btc-0.06-v2", amounts: { btc: "0.06", musd: "300" } };
    await writeFile(report, JSON.stringify(verification, null, 2) + "\n");
    console.log(JSON.stringify(verification));
  }
} catch (error) {
  // Connection errors can contain credentials; print only their class and code.
  console.error(JSON.stringify({ failed: true, errorClass: error.name, code: error.code ?? null }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
