"use client";

import { useAccount, useReadContract } from "wagmi";
import { MUSD_ABI, formatMusd } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";

/** Reads the connected wallet's mUSD balance on the active Mezo chain. */
export function useMusdBalance() {
  const { address } = useAccount();

  const query = useReadContract({
    abi: MUSD_ABI,
    address: MUSD_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: Boolean(address),
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
