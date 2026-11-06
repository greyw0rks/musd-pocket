"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address, WalletClient } from "viem";
import { useSession } from "@/lib/auth/session";
import { CHAIN_ID } from "@/lib/mezo/config";
import { sessionWallet } from "@/lib/wallet/session-wallet";

/** Reads, cached clients and signing all use the server's Pocket identity. */
export function useSessionWallet() {
  const { walletAddress } = useSession();
  const { address: activeAddress, chainId } = useAccount();
  const address = (walletAddress ?? undefined) as Address | undefined;
  const active = Boolean(address && activeAddress?.toLowerCase() === address.toLowerCase() && chainId === CHAIN_ID);
  const { data } = useWalletClient({
    account: address,
    chainId: CHAIN_ID,
    query: { enabled: active },
  });
  const wallet = active ? sessionWallet(data as WalletClient | undefined, walletAddress) : null;
  const latest = useRef<WalletClient | null>(wallet);
  const latestAddress = useRef<string | null>(walletAddress);
  useEffect(() => {
    latestAddress.current = walletAddress;
    return () => { latestAddress.current = null; };
  }, [walletAddress]);
  useEffect(() => {
    latest.current = wallet;
    return () => { latest.current = null; };
  }, [wallet]);
  const getWalletClient = useCallback(() => latest.current, []);
  const getWalletAddress = useCallback(() => latestAddress.current, []);
  return { address, wallet, getWalletClient, getWalletAddress };
}
