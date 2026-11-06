import { decodeEventLog, decodeFunctionData, erc20Abi, zeroAddress, type Address, type Hex } from "viem";
import { CHAIN_ID, MUSD_ADDRESS, activeBorrow } from "@/lib/mezo/config";
import { BORROWER_OPERATIONS_ABI } from "@/lib/mezo/borrow-write";
import { ESCROW, FACTORY, LOCK_ABI, MEZO_ASSET, POOLS, ROUTER, ROUTER_ABI } from "@/lib/mezo/wealth/contracts";

export const WEEKLY_TASKS = [
  { id: "send", title: "Send mUSD to 5 friends", detail: "Five different wallets, with confirmed transfers.", target: 5 },
  { id: "invite", title: "Invite 3 friends", detail: "Three new Pocket accounts join through your invite link.", target: 3 },
  { id: "borrow", title: "Borrow mUSD", detail: "Open a Bitcoin-backed loan.", target: 1 },
  { id: "repay", title: "Repay mUSD", detail: "Make a repayment or close your loan.", target: 1 },
  { id: "pool", title: "Add to a pool", detail: "Provide liquidity to a supported mUSD pool.", target: 1 },
  { id: "swap", title: "Swap mUSD", detail: "Complete a swap into or out of mUSD.", target: 1 },
  { id: "lock", title: "Lock MEZO", detail: "Create a lock or add MEZO to your position.", target: 1 },
] as const;
export type WeeklyTaskId = (typeof WEEKLY_TASKS)[number]["id"];
export type TaskActivity = { kind: string; counterparty: string | null; confirmedAt: Date };
export type WeeklyStatus = {
  weekStart: string; resetsAt: string; syncing: boolean;
  tasks: { id: WeeklyTaskId; title: string; detail: string; target: number; progress: number; complete: boolean }[];
  inviteUrl: string;
};

export function weekWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return { start, end: new Date(start.getTime() + 7 * 86400_000) };
}

export function taskProgress(activity: TaskActivity[], invited: number, now = new Date()) {
  const { start, end } = weekWindow(now);
  const current = activity.filter(item => item.confirmedAt >= start && item.confirmedAt < end);
  return WEEKLY_TASKS.map(task => {
    const count = task.id === "invite" ? invited : task.id === "send"
      ? new Set(current.filter(item => item.kind === "send" && item.counterparty).map(item => item.counterparty!.toLowerCase())).size
      : current.filter(item => item.kind === task.id).length;
    const progress = Math.min(task.target, count);
    return { ...task, progress, complete: progress >= task.target };
  });
}

const same = (a: string | null | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
type Log = { address: Address; data: Hex; topics: readonly Hex[] };
type Evidence = { from: string; to: string | null; input: Hex; status: string; logs: Log[] };

/** Discovery filter only. Every candidate still needs a confirmed RPC receipt. */
export function isTaskCandidate(to: string, input: Hex): boolean {
  try {
    if (same(to, MUSD_ADDRESS))
      return decodeFunctionData({ abi: erc20Abi, data: input }).functionName === "transfer";
    if (same(to, activeBorrow.borrowerOperations))
      return ["openTrove", "repayMUSD", "closeTrove"].includes(decodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, data: input }).functionName);
    if (CHAIN_ID === 31611 && same(to, ROUTER))
      return ["swapExactTokensForTokens", "addLiquidity"].includes(decodeFunctionData({ abi: ROUTER_ABI, data: input }).functionName);
    if (CHAIN_ID === 31611 && same(to, ESCROW))
      return ["createLock", "increaseAmount"].includes(decodeFunctionData({ abi: LOCK_ABI, data: input }).functionName);
  } catch { /* Unsupported calls cannot complete a checklist item. */ }
  return false;
}

/** Only mined successful calls from this wallet to the supported contracts count. */
export function classifyTaskTransaction(owner: string, evidence: Evidence): { kind: Exclude<WeeklyTaskId, "invite">; counterparty: string | null } | null {
  if (!same(evidence.from, owner) || evidence.status !== "success") return null;
  function transferred(token: string, from: string, to?: string) {
    return evidence.logs.reduce((total, log) => {
      if (!same(log.address, token)) return total;
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics as [Hex, ...Hex[]] });
        return same(decoded.args.from, from) && (!to || same(decoded.args.to, to)) ? total + decoded.args.value : total;
      } catch { return total; }
    }, 0n);
  }
  try {
    if (same(evidence.to, MUSD_ADDRESS)) {
      const call = decodeFunctionData({ abi: erc20Abi, data: evidence.input });
      if (call.functionName === "transfer" && call.args[1] > 0n && !same(call.args[0], owner) && !same(call.args[0], zeroAddress)
        && transferred(MUSD_ADDRESS, owner, call.args[0]) === call.args[1])
        return { kind: "send", counterparty: call.args[0].toLowerCase() };
    }
    if (same(evidence.to, activeBorrow.borrowerOperations)) {
      const call = decodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, data: evidence.input });
      if (call.functionName === "openTrove" && call.args[0] > 0n && transferred(MUSD_ADDRESS, zeroAddress, owner) >= call.args[0])
        return { kind: "borrow", counterparty: null };
      if ((call.functionName === "repayMUSD" && call.args[0] > 0n && transferred(MUSD_ADDRESS, owner, zeroAddress) >= call.args[0])
        || (call.functionName === "closeTrove" && transferred(MUSD_ADDRESS, owner, zeroAddress) > 0n))
        return { kind: "repay", counterparty: null };
    }
    if (CHAIN_ID === 31611 && same(evidence.to, ROUTER)) {
      const call = decodeFunctionData({ abi: ROUTER_ABI, data: evidence.input });
      if (call.functionName === "swapExactTokensForTokens") {
        const [amount, , routes, recipient] = call.args;
        if (amount > 0n && same(recipient, owner) && routes.length > 0 && routes.every(route => POOLS.some(pool =>
          same(route.factory, FACTORY) && route.stable === pool.stable &&
          ((same(route.from, pool.token0.address) && same(route.to, pool.token1.address)) || (same(route.from, pool.token1.address) && same(route.to, pool.token0.address)))
        )) && routes.some(route => same(route.from, MUSD_ADDRESS) || same(route.to, MUSD_ADDRESS))
          && (transferred(MUSD_ADDRESS, owner) > 0n || evidence.logs.some(log => {
            try { const event = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics as [Hex, ...Hex[]] }); return same(log.address, MUSD_ADDRESS) && same(event.args.to, owner) && event.args.value > 0n; } catch { return false; }
          }))) return { kind: "swap", counterparty: null };
      }
      if (call.functionName === "addLiquidity") {
        const [tokenA, tokenB, stable, amountA, amountB, , , recipient] = call.args;
        const pool = POOLS.find(pool => pool.stable === stable && ((same(tokenA, pool.token0.address) && same(tokenB, pool.token1.address)) || (same(tokenA, pool.token1.address) && same(tokenB, pool.token0.address))));
        if (pool && amountA > 0n && amountB > 0n && same(recipient, owner) && transferred(MUSD_ADDRESS, owner, pool.address) > 0n && transferred(pool.address, zeroAddress, owner) > 0n)
          return { kind: "pool", counterparty: null };
      }
    }
    if (CHAIN_ID === 31611 && same(evidence.to, ESCROW)) {
      const call = decodeFunctionData({ abi: LOCK_ABI, data: evidence.input });
      if ((call.functionName === "createLock" || call.functionName === "increaseAmount") && transferred(MEZO_ASSET.address, owner, ESCROW) > 0n)
        return { kind: "lock", counterparty: null };
    }
  } catch { /* Malformed/unsupported call is not proof of a task. */ }
  return null;
}
