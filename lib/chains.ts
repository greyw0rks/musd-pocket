import { ChainKey } from "@prisma/client";
import { CHAIN_ID, MUSD_ADDRESS, EXPLORER_URL } from "@/lib/mezo/config";

/**
 * Multi-chain registry. Pocket presents one chain-agnostic balance; this is the
 * reference data behind routing, the protocol dashboard, and chain labels.
 *
 * Only MEZO is REAL (Mezo testnet — the one chain we transact on). BASE and
 * ETHEREUM are MODELED: their mainnet MUSD + Wormhole NTT addresses are real
 * reference data, but Pocket simulates their vault liquidity + NTT settlement
 * (no MUSD/NTT exists on Base/Eth testnets, so a free live demo can't use them).
 */
export type ChainInfo = {
  key: ChainKey;
  label: string;
  chainId: number;
  /** MUSD token (lowercase). */
  musd: string;
  /** Wormhole NTT manager (burn-and-mint) — reference for the settlement story. */
  nttManager: string | null;
  /** True only for the chain we actually submit transactions on. */
  isReal: boolean;
  explorerBase: string;
};

export const CHAINS: Record<ChainKey, ChainInfo> = {
  [ChainKey.MEZO]: {
    key: ChainKey.MEZO,
    label: "Mezo",
    chainId: CHAIN_ID,
    musd: MUSD_ADDRESS.toLowerCase(),
    nttManager: "0x7efb386675d75280d39aae42964a6776de0ee0bd",
    isReal: true,
    explorerBase: EXPLORER_URL,
  },
  [ChainKey.BASE]: {
    key: ChainKey.BASE,
    label: "Base",
    chainId: 8453,
    musd: "0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186",
    nttManager: "0x3eb418bdbe95b4b9cf465ecfbd8424685acd1bc1",
    isReal: false,
    explorerBase: "https://basescan.org",
  },
  [ChainKey.ETHEREUM]: {
    key: ChainKey.ETHEREUM,
    label: "Ethereum",
    chainId: 1,
    musd: "0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186",
    nttManager: "0x5293158bf7a81ed05418da497a80f7e6dbf4477e",
    isReal: false,
    explorerBase: "https://etherscan.io",
  },
};

export const CHAIN_ORDER: ChainKey[] = [
  ChainKey.MEZO,
  ChainKey.BASE,
  ChainKey.ETHEREUM,
];

/** The single chain Pocket actually transacts on. */
export const REAL_CHAIN: ChainKey = ChainKey.MEZO;

export function chainInfo(key: ChainKey): ChainInfo {
  return CHAINS[key];
}

export function chainLabel(key: ChainKey): string {
  return CHAINS[key].label;
}

export function isRealChain(key: ChainKey): boolean {
  return CHAINS[key].isReal;
}

export function listChains(): ChainInfo[] {
  return CHAIN_ORDER.map((k) => CHAINS[k]);
}
