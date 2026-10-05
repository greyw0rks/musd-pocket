import { http, cookieStorage, createStorage } from "wagmi";
import { createConfig } from "@privy-io/wagmi";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { MEZO, activeChain, RPC_URL } from "@/lib/mezo/config";

/**
 * Privy is Pocket's everyday wallet: social login (X / Telegram / email) mints a
 * non-custodial embedded EOA on Mezo. External wallets stay a funding rail only.
 *
 * Gated by NEXT_PUBLIC_PRIVY_APP_ID: when unset, the app falls back to the plain
 * injected-wallet config (lib/wallet/config.ts) so it still builds/runs without keys.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function hasPrivy(): boolean {
  return PRIVY_APP_ID.length > 0;
}

/** PrivyProvider config. Embedded wallet auto-created for social-login users. */
export const privyConfig: PrivyClientConfig = {
  // X (twitter) + Telegram are the social rails; email as a fallback.
  loginMethods: ["twitter", "telegram", "email"],
  // Embedded wallet defaults to this chain; both Mezo envs are supported.
  defaultChain: activeChain,
  supportedChains: [MEZO.testnet.chain, MEZO.mainnet.chain],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
};

/**
 * wagmi config wired through Privy's connector. Mirrors lib/wallet/config.ts
 * exactly (single active chain so the shape matches wagmi's registered Config):
 * activeChain.id is statically the union of both Mezo ids, so a transport is
 * supplied for each; only the active one is wired to RPC_URL.
 */
export function getPrivyWagmiConfig() {
  return createConfig({
    chains: [activeChain],
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [MEZO.mainnet.chainId]: http(
        activeChain.id === MEZO.mainnet.chainId ? RPC_URL : undefined,
      ),
      [MEZO.testnet.chainId]: http(
        activeChain.id === MEZO.testnet.chainId ? RPC_URL : undefined,
      ),
    },
  });
}

