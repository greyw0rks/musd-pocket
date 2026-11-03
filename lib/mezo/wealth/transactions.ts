import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  type Address,
  type WalletClient,
} from "viem";
import { activeChain, CHAIN_ID } from "../config";
import { getPublicClient } from "../musd";
import {
  clearPendingWealth,
  readPendingWealth,
  storePendingWealth,
  type PendingWealth,
} from "./journal";
import type {
  WealthCall,
  WealthPlan,
  WealthReceipt,
  WealthStep,
} from "./types";

export const BTC_ERC20 = "0x7b7C000000000000000000000000000000000000";
const busy = new Set<string>();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sameCall = (a: WealthCall, b: WealthCall) =>
  same(a.to, b.to) && a.data === b.data && a.value === b.value;

export async function assertWealthNetwork() {
  if (CHAIN_ID !== 31611 || (await getPublicClient().getChainId()) !== CHAIN_ID)
    throw new Error("Switch to Mezo testnet to use pools and locks.");
}

/** One explicit wallet step per review: approvals never auto-submit the action. */
export async function prepareWealthStep(plan: WealthPlan): Promise<WealthStep> {
  await assertWealthNetwork();
  const rpc = getPublicClient();
  const block = await rpc.getBlock();
  if (plan.chainId !== CHAIN_ID || Number(block.timestamp) >= plan.expiresAt)
    throw new Error("This quote expired. Review a fresh quote.");
  await plan.validate();
  let call = plan.call;
  let kind: WealthStep["kind"] = "action";
  let label = plan.title;
  for (const spend of plan.spends) {
    const [balance, allowance] = await Promise.all([
      rpc.readContract({
        address: spend.asset.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [plan.owner],
      }),
      rpc.readContract({
        address: spend.asset.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [plan.owner, spend.spender],
      }),
    ]);
    if (balance < spend.amount)
      throw new Error(`Not enough ${spend.asset.symbol} in your wallet.`);
    if (kind === "action" && allowance < spend.amount) {
      // Tokens that require zero before a new allowance are supported explicitly.
      const amount = allowance > 0n ? 0n : spend.amount;
      call = {
        to: spend.asset.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [spend.spender, amount],
        }),
        value: 0n,
      };
      kind = "approval";
      label =
        amount === 0n
          ? `Reset ${spend.asset.symbol} approval`
          : `Approve ${formatUnits(amount, spend.asset.decimals)} ${spend.asset.symbol}`;
    }
  }
  const simulation = await rpc.call({ account: plan.owner, ...call });
  if (
    kind === "approval" &&
    simulation.data &&
    simulation.data !== "0x" &&
    !decodeFunctionResult({
      abi: erc20Abi,
      functionName: "approve",
      data: simulation.data,
    })
  )
    throw new Error("This token refused the approval.");
  const [gas, gasPrice, native] = await Promise.all([
    rpc.estimateGas({ account: plan.owner, ...call }),
    rpc.getGasPrice(),
    rpc.getBalance({ address: plan.owner }),
  ]);
  const estimatedGas = (gas * 120n) / 100n;
  const estimatedFee = estimatedGas * gasPrice;
  const nativeSpend = plan.spends
    .filter((spend) => same(spend.asset.address, BTC_ERC20))
    .reduce((sum, spend) => sum + spend.amount, 0n);
  if (native < nativeSpend + call.value + estimatedFee)
    throw new Error("Keep enough BTC for this amount and the network fee.");
  return { plan, kind, label, call, estimatedGas, estimatedFee };
}

async function readReceipt(
  saved: PendingWealth,
  wait: boolean,
): Promise<WealthReceipt> {
  const rpc = getPublicClient();
  await assertWealthNetwork();
  const base = {
    requestId: saved.requestId,
    hash: saved.hash,
    kind: saved.kind,
    title: saved.title,
  };
  if (!saved.hash) return { ...base, status: "pending" };
  try {
    const tx = await rpc.getTransaction({ hash: saved.hash });
    if (
      !same(tx.from, saved.owner) ||
      !tx.to ||
      !same(tx.to, saved.call.to) ||
      tx.input !== saved.call.data ||
      tx.value !== saved.call.value
    )
      throw new Error("Saved transaction does not match this wallet action.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Saved transaction"))
      throw error;
    return { ...base, status: "pending" };
  }
  try {
    const receipt = wait
      ? await rpc.waitForTransactionReceipt({
          hash: saved.hash,
          timeout: 25000,
        })
      : await rpc.getTransactionReceipt({ hash: saved.hash });
    if (!same(receipt.transactionHash, saved.hash))
      return { ...base, status: "pending" };
    clearPendingWealth(saved.owner, saved);
    return {
      ...base,
      status: receipt.status === "success" ? "confirmed" : "reverted",
    };
  } catch {
    return { ...base, status: "pending" };
  }
}

export async function recoverWealth(owner: Address) {
  const pending = readPendingWealth(owner);
  return pending ? readReceipt(pending, false) : null;
}

/** Verifies the reviewed step again immediately before asking the wallet. */
export async function executeWealthStep(
  step: WealthStep,
  getWallet: () => WalletClient | null,
  getOwner: () => string | null,
): Promise<WealthReceipt> {
  const owner = step.plan.owner;
  const key = `pocket:wealth:${CHAIN_ID}:${owner.toLowerCase()}`;
  const run = async (): Promise<WealthReceipt> => {
    const pending = readPendingWealth(owner);
    if (pending) {
      if (pending.kind !== step.kind || !sameCall(pending.call, step.call))
        throw new Error(
          "Another wallet action is pending. Check its confirmation before starting this action.",
        );
      return readReceipt(pending, false);
    }
    const fresh = await prepareWealthStep(step.plan);
    if (fresh.kind !== step.kind || !sameCall(fresh.call, step.call))
      throw new Error("The next step changed. Review it again before signing.");
    const wallet = getWallet();
    if (
      !wallet?.account ||
      !same(wallet.account.address, owner) ||
      !getOwner() ||
      !same(getOwner()!, owner)
    )
      throw new Error(
        "Your active wallet changed. Reopen this action with your Pocket wallet.",
      );
    if (
      (await wallet.getChainId()) !== CHAIN_ID ||
      wallet.chain?.id !== CHAIN_ID
    )
      throw new Error("Switch your wallet to Mezo testnet.");
    // Re-check the live getters after network reads; a changed account cannot
    // sign a review made for the preceding session.
    if (
      getWallet()?.account?.address.toLowerCase() !== owner.toLowerCase() ||
      getOwner()?.toLowerCase() !== owner.toLowerCase()
    )
      throw new Error("Your wallet changed. Review this action again.");
    // Reserve before prompting. A provider can time out after broadcasting;
    // an unknown outcome must survive a reload without signing again.
    const saved: PendingWealth = {
      requestId: crypto.randomUUID(),
      owner,
      chainId: CHAIN_ID,
      hash: null,
      kind: step.kind,
      title: step.label,
      call: step.call,
    };
    storePendingWealth(saved);
    try {
      saved.hash = await wallet.sendTransaction({
        account: wallet.account,
        chain: activeChain,
        ...step.call,
        gas: fresh.estimatedGas,
      });
    } catch (error) {
      let cause: unknown = error;
      for (
        let depth = 0;
        cause && typeof cause === "object" && depth < 8;
        depth++
      ) {
        const info = cause as { code?: number; name?: string; cause?: unknown };
        if (info.code === 4001 || info.name === "UserRejectedRequestError") {
          clearPendingWealth(owner, saved);
          throw new Error("You cancelled the wallet request.");
        }
        cause = info.cause;
      }
      return {
        requestId: saved.requestId,
        hash: null,
        kind: step.kind,
        title: step.label,
        status: "pending",
      };
    }
    storePendingWealth(saved);
    return readReceipt(saved, true);
  };
  if (busy.has(key)) throw new Error("A wallet action is already in progress.");
  busy.add(key);
  try {
    if (typeof navigator !== "undefined" && navigator.locks)
      return await navigator.locks.request(
        key,
        { ifAvailable: true },
        async (lock) => {
          if (!lock)
            throw new Error(
              "A wallet action is already in progress in another tab.",
            );
          return run();
        },
      );
    return await run();
  } finally {
    busy.delete(key);
  }
}
