import { encodeFunctionData, erc20Abi, formatUnits, type Address } from "viem";
import { CHAIN_ID } from "../config";
import { getPublicClient } from "../musd";
import { assertWealthNetwork } from "./transactions";
import { LOCK_CONTRACTS, LOCK_ABI, MEZO_LOCK_ABI, LOCK_MAX_TIME_SLOT, type LockAsset } from "./contracts";
import { exactAmount, roundedLockEnd } from "./math";
import type { WealthPlan } from "./types";

export type LockIntent =
  | { kind: "create"; amount: string; weeks: number }
  | { kind: "increase"; tokenId: string; amount: string }
  | { kind: "extend"; tokenId: string; weeks: number }
  | { kind: "withdraw" | "permanent" | "start-unlock"; tokenId: string };

export async function readLockAccount(owner: Address, asset: LockAsset = "btc") {
  await assertWealthNetwork();
  const rpc = getPublicClient();
  const { asset: lockToken, escrow: ESCROW, implementation: expectedImplementation, maxLockTime } = LOCK_CONTRACTS[asset];
  const [balance, token, decimals, implementation, storedMaxTime] = await Promise.all([
    rpc.readContract({
      address: lockToken.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    rpc.readContract({ address: ESCROW, abi: LOCK_ABI, functionName: "token" }),
    rpc.readContract({
      address: lockToken.address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    // Token and duration checks are interpreted only for this known layout.
    rpc.getStorageAt({
      address: ESCROW,
      slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    }),
    rpc.getStorageAt({ address: ESCROW, slot: LOCK_MAX_TIME_SLOT }),
  ]);
  if (
    implementation?.slice(-40).toLowerCase() !==
    expectedImplementation.slice(2).toLowerCase()
  )
    throw new Error(
      "The lock contract was upgraded. Its rules need to be verified before using locks.",
    );
  if (!storedMaxTime || BigInt(storedMaxTime) !== maxLockTime)
    throw new Error("The lock duration rules changed. Review the contract before using locks.");
  if (
    token.toLowerCase() !== lockToken.address.toLowerCase() ||
    decimals !== 18
  )
    throw new Error(`The lock contract's ${lockToken.symbol} configuration changed.`);
  return { balance };
}

async function readPosition(
  owner: Address,
  tokenId: bigint,
  blockNumber: bigint,
  asset: LockAsset,
) {
  const rpc = getPublicClient();
  const { escrow: ESCROW, asset: lockToken } = LOCK_CONTRACTS[asset];
  const abi = asset === "btc" ? LOCK_ABI : MEZO_LOCK_ABI;
  const [holder, locked, voted, escrowType, vestingEnd] = await Promise.all([
    rpc.readContract({
      address: ESCROW,
      abi,
      functionName: "ownerOf",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi,
      functionName: "locked",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi,
      functionName: "voted",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi,
      functionName: "escrowType",
      args: [tokenId],
      blockNumber,
    }),
    rpc.readContract({
      address: ESCROW,
      abi,
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
  if (locked.amount <= 0n) throw new Error(`This lock has no ${lockToken.symbol} remaining.`);
  return { ...locked, voted, vestingEnd };
}

export async function quoteLock(
  owner: Address,
  intent: LockIntent,
  asset: LockAsset = "btc",
): Promise<WealthPlan> {
  if (asset === "mezo" && (intent.kind === "create" || intent.kind === "increase"))
    throw new Error("New lock deposits use BTC. Existing MEZO positions can still be extended or withdrawn.");
  await readLockAccount(owner, asset);
  const { escrow: ESCROW, asset: lockToken, name, maxLockTime } = LOCK_CONTRACTS[asset];
  const symbol = lockToken.symbol;
  const unlockWait = asset === "btc" ? "a new wait of up to 30 days" : "a new 208-week countdown";
  const rpc = getPublicClient();
  const block = await rpc.getBlock();
  const tokenId =
    "tokenId" in intent && /^\d+$/.test(intent.tokenId)
      ? BigInt(intent.tokenId)
      : null;
  if (intent.kind !== "create" && (!tokenId || tokenId >= 2n ** 256n))
    throw new Error("Choose a valid lock.");
  const position = tokenId
    ? await readPosition(owner, tokenId, block.number, asset)
    : null;
  let data: `0x${string}`;
  let title: string;
  let expectedEnd: bigint | null = null;
  const spends: WealthPlan["spends"] = [];
  const details: WealthPlan["details"] = [];
  if (tokenId) details.push({ label: "Position", value: `${name} #${tokenId}` });
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
        `An expired or unvested grant lock cannot accept more ${symbol}.`,
      );
    spends.push({ asset: lockToken, amount, spender: ESCROW });
    details.push({ label: `${symbol} to lock`, value: formatUnits(amount, 18) });
    if (intent.kind === "create") {
      const { duration, end } = roundedLockEnd(
        block.timestamp,
        intent.weeks,
        maxLockTime,
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
      maxLockTime,
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
    title = `Withdraw ${symbol}`;
    details.push({
      label: `${symbol} returned to your wallet`,
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
        `No scheduled expiry. Starting an unlock later begins ${unlockWait}.`,
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
    expectedEnd = ((block.timestamp + maxLockTime) / 604800n) * 604800n;
    title = asset === "btc" ? "Start BTC unlock" : "Start 208-week unlock";
    details.push({
      label: `${symbol} remains locked`,
      value:
        `This starts ${unlockWait}; it does not withdraw your ${symbol}.`,
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
      await readLockAccount(owner, asset);
      const now = await rpc.getBlock();
      if (tokenId) {
        const current = await readPosition(owner, tokenId, now.number, asset);
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
        const end = intent.kind === "start-unlock"
          ? ((now.timestamp + maxLockTime) / 604800n) * 604800n
          : roundedLockEnd(now.timestamp, "weeks" in intent ? intent.weeks : 0, maxLockTime).end;
        if (end !== expectedEnd)
          throw new Error(
            "The weekly unlock date changed. Review a fresh quote.",
          );
      }
    },
  };
}
