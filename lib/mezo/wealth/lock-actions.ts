import { encodeFunctionData, erc20Abi, formatUnits, type Address } from "viem";
import { CHAIN_ID } from "../config";
import { getPublicClient } from "../musd";
import { assertWealthNetwork } from "./transactions";
import { ESCROW, LOCK_ABI, MAX_LOCK_TIME, MEZO_ASSET } from "./contracts";
import { exactAmount, roundedLockEnd } from "./math";
import type { WealthPlan } from "./types";

export type LockIntent =
  | { kind: "create"; amount: string; weeks: number }
  | { kind: "increase"; tokenId: string; amount: string }
  | { kind: "extend"; tokenId: string; weeks: number }
  | { kind: "withdraw" | "permanent" | "start-unlock"; tokenId: string };

export async function readLockAccount(owner: Address) {
  await assertWealthNetwork();
  const rpc = getPublicClient();
  const [balance, token, decimals, implementation] = await Promise.all([
    rpc.readContract({
      address: MEZO_ASSET.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    rpc.readContract({ address: ESCROW, abi: LOCK_ABI, functionName: "token" }),
    rpc.readContract({
      address: MEZO_ASSET.address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    // The 208-week duration is verified against this deployed implementation.
    rpc.getStorageAt({
      address: ESCROW,
      slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    }),
  ]);
  if (
    implementation?.slice(-40).toLowerCase() !==
    "9665873019a05bee102903c9df602da06555ae0a"
  )
    throw new Error(
      "The lock contract was upgraded. Its rules need to be verified before using locks.",
    );
  if (
    token.toLowerCase() !== MEZO_ASSET.address.toLowerCase() ||
    decimals !== 18
  )
    throw new Error("The lock contract's MEZO configuration changed.");
  return { balance };
}

async function readPosition(
  owner: Address,
  tokenId: bigint,
  blockNumber: bigint,
) {
  const rpc = getPublicClient();
  const [holder, locked, voted, escrowType, vestingEnd] = await Promise.all([
    rpc.readContract({
      address: ESCROW,
      abi: LOCK_ABI,
      functionName: "ownerOf",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi: LOCK_ABI,
      functionName: "locked",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi: LOCK_ABI,
      functionName: "voted",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi: LOCK_ABI,
      functionName: "escrowType",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi: LOCK_ABI,
      functionName: "vestingEnd",
      args: [tokenId],
      blockNumber,
    }),
  ]);
  if (holder.toLowerCase() !== owner.toLowerCase())
    throw new Error("This lock is no longer owned by your Pocket wallet.");
  if (escrowType !== 0)
    throw new Error(
      "This position is managed or deposited in another lock. Its manager must release it first.",
    );
  if (locked.amount <= 0n) throw new Error("This lock has no MEZO remaining.");
  return { ...locked, voted, vestingEnd };
}

export async function quoteLock(
  owner: Address,
  intent: LockIntent,
): Promise<WealthPlan> {
  await readLockAccount(owner);
  const rpc = getPublicClient();
  const block = await rpc.getBlock();
  const tokenId =
    "tokenId" in intent && /^\d+$/.test(intent.tokenId)
      ? BigInt(intent.tokenId)
      : null;
  if (intent.kind !== "create" && (!tokenId || tokenId >= 2n ** 256n))
    throw new Error("Choose a valid lock.");
  const position = tokenId
    ? await readPosition(owner, tokenId, block.number)
    : null;
  let data: `0x${string}`;
  let title: string;
  let expectedEnd: bigint | null = null;
  const spends: WealthPlan["spends"] = [];
  const details: WealthPlan["details"] = [];
  if (tokenId) details.push({ label: "Position", value: `veMEZO #${tokenId}` });
  if (intent.kind === "create" || intent.kind === "increase") {
    const amount = exactAmount(intent.amount, 18);
    if (
      amount >= 2n ** 127n ||
      (position && position.amount + amount >= 2n ** 127n)
    )
      throw new Error("The amount exceeds this lock's capacity.");
    if (
      position &&
      ((!position.isPermanent && position.end <= block.timestamp) ||
        position.vestingEnd > block.timestamp)
    )
      throw new Error(
        "An expired or unvested grant lock cannot accept more MEZO.",
      );
    spends.push({ asset: MEZO_ASSET, amount, spender: ESCROW });
    details.push({ label: "MEZO to lock", value: formatUnits(amount, 18) });
    if (intent.kind === "create") {
      const { duration, end } = roundedLockEnd(
        block.timestamp,
        intent.weeks,
        MAX_LOCK_TIME,
      );
      expectedEnd = end;
      data = encodeFunctionData({
        abi: LOCK_ABI,
        functionName: "createLock",
        args: [amount, duration],
      });
      title = "Create lock";
    } else {
      data = encodeFunctionData({
        abi: LOCK_ABI,
        functionName: "increaseAmount",
        args: [tokenId!, amount],
      });
      title = "Add to lock";
      expectedEnd = position!.isPermanent ? null : position!.end;
    }
  } else if (intent.kind === "extend") {
    if (position!.isPermanent || position!.end <= block.timestamp)
      throw new Error("Only an active timed lock can be extended.");
    const { duration, end } = roundedLockEnd(
      block.timestamp,
      intent.weeks,
      MAX_LOCK_TIME,
    );
    if (end <= position!.end)
      throw new Error("Choose an unlock date later than the existing one.");
    expectedEnd = end;
    title = "Extend lock";
    data = encodeFunctionData({
      abi: LOCK_ABI,
      functionName: "increaseUnlockTime",
      args: [tokenId!, duration],
    });
  } else if (intent.kind === "withdraw") {
    if (position!.isPermanent || position!.end > block.timestamp)
      throw new Error("This lock has not reached its unlock date.");
    if (position!.voted)
      throw new Error(
        "Remove this position's assigned votes before withdrawing.",
      );
    title = "Withdraw MEZO";
    details.push({
      label: "MEZO returned to your wallet",
      value: formatUnits(position!.amount, 18),
    });
    data = encodeFunctionData({
      abi: LOCK_ABI,
      functionName: "withdraw",
      args: [tokenId!],
    });
  } else if (intent.kind === "permanent") {
    if (position!.isPermanent || position!.end <= block.timestamp)
      throw new Error("Choose an active timed lock.");
    title = "Make lock permanent";
    details.push({
      label: "Withdrawal",
      value:
        "No scheduled expiry. Starting an unlock later begins a 208-week countdown.",
    });
    data = encodeFunctionData({
      abi: LOCK_ABI,
      functionName: "lockPermanent",
      args: [tokenId!],
    });
  } else {
    if (!position!.isPermanent)
      throw new Error("This lock already has a scheduled expiry.");
    if (position!.voted)
      throw new Error(
        "Remove this position's assigned votes before starting its unlock countdown.",
      );
    expectedEnd = roundedLockEnd(block.timestamp, 208, MAX_LOCK_TIME).end;
    title = "Start 208-week unlock";
    details.push({
      label: "MEZO remains locked",
      value:
        "This starts a new 208-week countdown; it does not withdraw your MEZO.",
    });
    data = encodeFunctionData({
      abi: LOCK_ABI,
      functionName: "unlockPermanent",
      args: [tokenId!],
    });
  }
  if (expectedEnd)
    details.push({
      label: "Unlock date",
      value: new Date(Number(expectedEnd) * 1000).toISOString(),
    });
  details.push({ label: "Owner and recipient", value: owner });
  return {
    owner,
    chainId: CHAIN_ID,
    title,
    expiresAt: Number(block.timestamp) + 300,
    details,
    spends,
    call: { to: ESCROW, data, value: 0n },
    validate: async () => {
      await readLockAccount(owner);
      const now = await rpc.getBlock();
      if (tokenId) {
        const current = await readPosition(owner, tokenId, now.number);
        if (
          current.amount !== position!.amount ||
          current.end !== position!.end ||
          current.isPermanent !== position!.isPermanent ||
          current.voted !== position!.voted ||
          current.vestingEnd !== position!.vestingEnd
        )
          throw new Error("The lock changed. Review a fresh quote.");
      }
      if (
        intent.kind === "create" ||
        intent.kind === "extend" ||
        intent.kind === "start-unlock"
      ) {
        const weeks = "weeks" in intent ? intent.weeks : 208;
        if (
          roundedLockEnd(now.timestamp, weeks, MAX_LOCK_TIME).end !==
          expectedEnd
        )
          throw new Error(
            "The weekly unlock date changed. Review a fresh quote.",
          );
      }
    },
  };
}
