import { mezo, mezoTestnet } from "viem/chains";
import type { Address } from "viem";

/**
 * Single source of truth for Mezo network + mUSD token config.
 *
 * Facts verified against the official Mezo docs (2026-09-29):
 *  - Mainnet chain ID 31612, Testnet chain ID 31611
 *  - Native gas currency is BTC (18 decimals) on both — gas is NOT paid in mUSD
 *  - mUSD is an 18-decimal ERC-20
 *  - Mainnet mUSD: 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186
 *  - Testnet mUSD: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
 * Sources: mezo.org/docs/users/resources/contracts-reference,
 *          mezo.org/docs/users/getting-started/connect/
 */
export const MEZO = {
  mainnet: {
    chain: mezo,
    chainId: 31612,
    musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186" as Address,
  },
  testnet: {
    chain: mezoTestnet,
    chainId: 31611,
    musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as Address,
  },
} as const;

export type MezoEnv = keyof typeof MEZO;

/** mUSD always uses 18 decimals (matches BTC gas token). */
export const MUSD_DECIMALS = 18;
export const MUSD_SYMBOL = "mUSD";

/** Testnet-first: default to testnet unless explicitly set to mainnet. */
export const ACTIVE_ENV: MezoEnv =
  process.env.NEXT_PUBLIC_MEZO_ENV === "mainnet" ? "mainnet" : "testnet";

export const activeMezo = MEZO[ACTIVE_ENV];
export const activeChain = activeMezo.chain;
export const MUSD_ADDRESS = activeMezo.musd;
export const CHAIN_ID = activeMezo.chainId;

/** Optional RPC override (e.g. a paid endpoint) via env. */
export const RPC_URL =
  process.env.NEXT_PUBLIC_MEZO_RPC_URL ||
  activeChain.rpcUrls.default.http[0];

export const EXPLORER_URL =
  activeChain.blockExplorers?.default.url ?? "https://explorer.mezo.org";
