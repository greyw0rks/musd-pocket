import type { Address } from "viem";
import { formatUnits } from "viem";
import { getPublicClient } from "./musd";
import { CHAIN_ID } from "./config";
import { TESTNET_VEMEZO, WELCOME_ESCROW_ABI } from "@/lib/rewards/abi";

export type MezoLock = {
  tokenId: string;
  amount: string;
  unlockAt: string | null;
  permanent: boolean;
};

/** Enumerates the current owner's NFTs, including transferred and extended locks. */
export async function readMezoLocks(owner: Address, page = 0) {
  const client = getPublicClient();
  if (CHAIN_ID !== 31611 || (await client.getChainId()) !== CHAIN_ID) {
    throw new Error("Lock reads are configured for Mezo testnet.");
  }
  if (!Number.isSafeInteger(page) || page < 0)
    throw new Error("Invalid lock page.");
  const blockNumber = await client.getBlockNumber();
  const count = await client.readContract({
    address: TESTNET_VEMEZO,
    abi: WELCOME_ESCROW_ABI,
    functionName: "balanceOf",
    args: [owner],
    blockNumber,
  });
  const start = BigInt(page) * 20n;
  const remaining = count > start ? count - start : 0n;
  const size = Number(remaining > 20n ? 20n : remaining);
  const locks = await Promise.all(
    Array.from({ length: size }, async (_, i) => {
      const tokenId = await client.readContract({
        address: TESTNET_VEMEZO,
        abi: WELCOME_ESCROW_ABI,
        functionName: "ownerToNFTokenIdList",
        args: [owner, start + BigInt(i)],
        blockNumber,
      });
      const [position, currentOwner] = await Promise.all([
        client.readContract({
          address: TESTNET_VEMEZO,
          abi: WELCOME_ESCROW_ABI,
          functionName: "locked",
          args: [tokenId],
          blockNumber,
        }),
        client.readContract({
          address: TESTNET_VEMEZO,
          abi: WELCOME_ESCROW_ABI,
          functionName: "ownerOf",
          args: [tokenId],
          blockNumber,
        }),
      ]);
      if (currentOwner.toLowerCase() !== owner.toLowerCase())
        throw new Error("Lock ownership could not be verified.");
      if (position.amount <= 0n) return null;
      return {
        tokenId: tokenId.toString(),
        amount: formatUnits(position.amount, 18),
        unlockAt: position.isPermanent
          ? null
          : new Date(Number(position.end) * 1000).toISOString(),
        permanent: position.isPermanent,
      } satisfies MezoLock;
    }),
  );
  return {
    locks: locks.filter((lock): lock is MezoLock => lock !== null),
    totalCount: count.toString(),
    hasNext: start + BigInt(size) < count,
    blockNumber: blockNumber.toString(),
  };
}

export function timeToUnlock(unlockAt: string | null, now: number) {
  if (unlockAt === null) return "Permanent lock";
  const ms = new Date(unlockAt).getTime() - now;
  if (ms <= 0) return "Ready to unlock";
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${mins}m to unlock`;
}
