"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { CHAIN_ID, ACTIVE_ENV, activeChain } from "@/lib/mezo/config";

/** Wrong-network detection + switch target for the active Mezo chain. */
export function useMezoNetwork() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  return {
    chainId,
    expectedChainId: CHAIN_ID,
    env: ACTIVE_ENV,
    networkName: activeChain.name,
    wrongNetwork,
    isSwitching: isPending,
    switchToMezo: () => switchChain({ chainId: CHAIN_ID }),
  };
}
