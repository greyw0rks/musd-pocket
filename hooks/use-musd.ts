"use client";

import { useReadContract } from "wagmi";
import { useSession } from "@/lib/auth/session";
import type { Address } from "viem";
import { MUSD_ABI, formatMusd } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";

/**
 * Reads the session wallet's mUSD balance on the configured Mezo chain,
 * including while the signing connector is still becoming ready.
 */
export function useMusdBalance(options?: { enabled?: boolean }) {
  const { walletAddress } = useSession();
  const address = (walletAddress ?? undefined) as Address | undefined;

  const query = useReadContract({
    abi: MUSD_ABI,
    address: MUSD_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: (options?.enabled ?? true) && Boolean(address),
      refetchInterval: 15_000,
    },
  });

  const raw = (query.data as bigint | undefined) ?? undefined;

  return {
    raw,
    formatted: raw !== undefined ? formatMusd(raw) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
