import type { WalletClient } from "viem";
import { CHAIN_ID } from "@/lib/mezo/config";

/** Never use a cached client for another Pocket account or network. */
export function sessionWallet(
  wallet: WalletClient | null | undefined,
  owner: string | null,
): WalletClient | null {
  return owner && wallet?.account && wallet.chain?.id === CHAIN_ID &&
    wallet.account.address.toLowerCase() === owner.toLowerCase()
    ? wallet
    : null;
}

/** Recheck the live connector after preflight, immediately before a signature. */
export async function assertCurrentSigner(
  wallet: WalletClient,
  current: () => WalletClient | null,
  rpc: { getChainId: () => Promise<number> },
) {
  const sameWallet = () => {
    const now = current();
    return wallet.account && now?.account &&
      now.account.address.toLowerCase() === wallet.account.address.toLowerCase() &&
      now.chain?.id === CHAIN_ID;
  };
  if (!sameWallet()) throw new Error("Your Pocket wallet changed. Review this action again.");
  const [network, providerNetwork, accounts] = await Promise.all([rpc.getChainId(), wallet.getChainId(), wallet.getAddresses()]);
  if (network !== CHAIN_ID || providerNetwork !== CHAIN_ID || wallet.chain?.id !== CHAIN_ID)
    throw new Error("Connect your Pocket wallet to Mezo and try again.");
  if (!accounts.some(address => address.toLowerCase() === wallet.account!.address.toLowerCase()))
    throw new Error("Your Pocket wallet changed. Review this action again.");
  if (!sameWallet()) throw new Error("Your Pocket wallet changed. Review this action again.");
}
