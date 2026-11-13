"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { readMezoLocks } from "@/lib/mezo/locks";
import { CHAIN_ID } from "@/lib/mezo/config";
import { LOCK_CONTRACTS, type LockAsset } from "@/lib/mezo/wealth/contracts";

export function useMezoLocks(open: boolean, page = 0, asset: LockAsset = "btc") {
  const { walletAddress } = useSession();
  return useQuery({
    queryKey: ["mezo-locks", CHAIN_ID, LOCK_CONTRACTS[asset].escrow, walletAddress, page],
    enabled: open && Boolean(walletAddress),
    queryFn: () => readMezoLocks(walletAddress as `0x${string}`, page, asset),
    refetchInterval: open ? 15_000 : false,
  });
}
