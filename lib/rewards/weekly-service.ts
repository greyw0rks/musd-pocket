import "server-only";
import { type Hex } from "viem";
import { prisma } from "@/lib/db";
import { CHAIN_ID } from "@/lib/mezo/config";
import { getPublicClient } from "@/lib/mezo/musd";
import { classifyTaskTransaction, isTaskCandidate, taskProgress, weekWindow, type WeeklyStatus } from "./weekly";
import { referralCode } from "./referrals";

// Deduplicate simultaneous sheet refreshes for a wallet. All lasting data is in DB.
const pending = new Map<string, Promise<boolean>>();

async function syncWeek(wallet: string, start: Date, end: Date): Promise<boolean> {
  const rpc = getPublicClient();
  if (await rpc.getChainId() !== CHAIN_ID) throw new Error("Task RPC network mismatch.");
  const base = CHAIN_ID === 31611 ? "https://api.explorer.test.mezo.org" : "https://api.explorer.mezo.org";
  const endpoint = `${base}/api/v2/addresses/${wallet}/transactions`;
  let params: Record<string, string> = { filter: "from" };
  let complete = false;
  const candidates: Hex[] = [];
  for (let page = 0; page < 4; page++) {
    const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("Activity index is temporarily unavailable.");
    const data = await response.json() as { items: { hash: string; timestamp: string | null; status: string; raw_input?: Hex; to?: { hash: string } | null }[]; next_page_params: Record<string, string> | null };
    if (!Array.isArray(data.items)) throw new Error("Invalid activity index response.");
    for (const item of data.items) {
      // The index only discovers hashes. Final eligibility uses RPC block time.
      if (item.timestamp && new Date(item.timestamp) < start) { complete = true; continue; }
      // Approvals and unrelated calls cannot earn task progress. Missing
      // discovery fields still get checked, rather than hiding activity.
      if (item.status === "ok" && /^0x[\da-f]{64}$/i.test(item.hash)
        && (!item.raw_input || !item.to?.hash || isTaskCandidate(item.to.hash, item.raw_input)))
        candidates.push(item.hash as Hex);
    }
    if (complete || !data.next_page_params) { complete = true; break; }
    params = { ...data.next_page_params, filter: "from" };
  }
  const known = await prisma.weeklyActivity.findMany({ where: { chainId: CHAIN_ID, txHash: { in: candidates } }, select: { txHash: true } });
  const seen = new Set(known.map(row => row.txHash));
  const hashes = [...new Set(candidates)].filter(hash => !seen.has(hash));
  let failed = false;
  // Bound RPC concurrency; approvals and unknown calls simply do not qualify.
  for (let index = 0; index < hashes.length; index += 4) {
    await Promise.all(hashes.slice(index, index + 4).map(async hash => {
      try {
        const receipt = await rpc.getTransactionReceipt({ hash });
        if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase() || receipt.status !== "success") return;
        const block = await rpc.getBlock({ blockNumber: receipt.blockNumber });
        if (block.hash !== receipt.blockHash) return;
        const tx = await rpc.getTransaction({ hash }).catch(async () => {
          // Mezo can retain a mined receipt while eth_getTransactionByHash
          // returns null. Recover calldata from the indexed transaction, but
          // anchor its hash, sender, target and block to the actual RPC receipt.
          const response = await fetch(`${base}/api/v2/transactions/${hash}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
          if (!response.ok) throw new Error("Transaction details are still syncing.");
          const indexed = await response.json() as { hash: string; status: string; from: { hash: string }; to: { hash: string } | null; block_number: number; raw_input: Hex };
          if (indexed.hash?.toLowerCase() !== hash.toLowerCase() || indexed.status !== "ok"
            || BigInt(indexed.block_number) !== receipt.blockNumber
            || indexed.from?.hash.toLowerCase() !== receipt.from.toLowerCase()
            || indexed.to?.hash.toLowerCase() !== receipt.to?.toLowerCase()
            || !/^0x(?:[\da-f]{2})*$/i.test(indexed.raw_input))
            throw new Error("Indexed transaction does not match the confirmed receipt.");
          return { from: receipt.from, to: receipt.to, input: indexed.raw_input, blockNumber: receipt.blockNumber };
        });
        if (!tx.blockNumber || tx.blockNumber !== receipt.blockNumber || tx.from.toLowerCase() !== receipt.from.toLowerCase() || tx.to?.toLowerCase() !== receipt.to?.toLowerCase()) return;
        const event = classifyTaskTransaction(wallet, { from: tx.from, to: tx.to, input: tx.input, status: receipt.status, logs: receipt.logs });
        if (!event) return;
        if (event.kind === "send" && event.counterparty) {
          const bytecode = await rpc.getBytecode({ address: event.counterparty as `0x${string}` });
          if (bytecode && bytecode !== "0x") return; // Contracts are not friends.
          const recipient = await prisma.user.findUnique({ where: { walletAddress: event.counterparty }, select: { role: true } });
          if (recipient?.role === "MERCHANT") return;
        }
        const confirmedAt = new Date(Number(block.timestamp) * 1000);
        if (confirmedAt < start || confirmedAt >= end) return;
        await prisma.weeklyActivity.upsert({
          where: { chainId_txHash: { chainId: CHAIN_ID, txHash: hash } }, update: {},
          create: { chainId: CHAIN_ID, txHash: hash, walletAddress: wallet, ...event, confirmedAt },
        });
      } catch (error) {
        failed = true;
        console.warn("Weekly activity verification is incomplete", {
          chainId: CHAIN_ID, txHash: hash,
          error: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }));
  }
  return complete && !failed;
}

export async function weeklyStatus(userId: string, wallet: string, now = new Date()): Promise<WeeklyStatus> {
  wallet = wallet.toLowerCase();
  const { start, end } = weekWindow(now);
  const key = `${CHAIN_ID}:${wallet}:${start.toISOString()}`;
  let syncing = true;
  try {
    let request = pending.get(key);
    if (!request) { request = syncWeek(wallet, start, end); pending.set(key, request); }
    try { syncing = !(await request); } finally { if (pending.get(key) === request) pending.delete(key); }
  } catch { /* Show retained proof plus an explicit syncing state. */ }
  const [activity, invited, code] = await Promise.all([
    prisma.weeklyActivity.findMany({ where: { chainId: CHAIN_ID, walletAddress: wallet, confirmedAt: { gte: start, lt: end } } }),
    prisma.referral.count({ where: { inviterId: userId, joinedAt: { gte: start, lt: end } } }),
    referralCode(userId),
  ]);
  return { weekStart: start.toISOString(), resetsAt: end.toISOString(), syncing, tasks: taskProgress(activity, invited, now), inviteUrl: `https://mpocket.tech/home?ref=${code}` };
}
