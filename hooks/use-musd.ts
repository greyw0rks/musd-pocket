"use client";

import { useAccount, useReadContract } from "wagmi";
import { MUSD_ABI, formatMusd } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";

/**
 * Reads the connected wallet's mUSD balance on the active Mezo chain.
 *
 * `enabled` lets a caller switch the read off entirely, for a mount that has
 * nothing to read yet — before `EmbeddedWalletActivator` has made the Privy
 * wallet the active account, `useAccount()` returns an address that is not the
 * one holding the money.
 */
export function useMusdBalance(options?: { enabled?: boolean }) {
  const { address } = useAccount();

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
