"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { readMezoLocks } from "@/lib/mezo/locks";
import { CHAIN_ID } from "@/lib/mezo/config";

export function useMezoLocks(open: boolean, page = 0) {
  const { walletAddress } = useSession();
  return useQuery({
    queryKey: ["mezo-locks", CHAIN_ID, walletAddress, page],
    enabled: open && Boolean(walletAddress),
    queryFn: () => readMezoLocks(walletAddress as `0x${string}`, page),
    refetchInterval: open ? 15_000 : false,
  });
}
