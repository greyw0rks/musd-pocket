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
    borrow: {
      borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031" as Address,
      troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193" as Address,
      priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88" as Address,
      sortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f" as Address,
      hintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3" as Address,
      activePool: "0x3012C2fE1240e3754E5C200A0946bb0E07474876" as Address,
      stabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32" as Address,
    },
  },
  testnet: {
    chain: mezoTestnet,
    chainId: 31611,
    musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as Address,
    borrow: {
      borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5" as Address,
      troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0" as Address,
      priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366" as Address,
      sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA" as Address,
      hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6" as Address,
      activePool: "0x143A063F62340DA3A8bEA1C5642d18C6D0F7FF51" as Address,
      stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e" as Address,
    },
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

/**
 * The MUSD CDP — Mezo's fork of Liquity v1 ("based on Threshold USD").
 *
 * Every address above was checked against the chain it belongs to, not copied
 * from a deploy artifact and trusted. Each was asked for a fact only that
 * contract can answer, and a wrong address would fail
 * loudly there rather than become a screen showing a calm zero. On both
 * networks it read back: `borrowerOperations.musd` → that network's real MUSD,
 * `minNetDebt` = 1,800, `MUSD_GAS_COMPENSATION` = 200, `troveManager.MCR` =
 * 110%, `.CCR` = 150%, and the two cross-references (`troveManager
 * .borrowerOperations`, `sortedTroves.troveManager`) pointing at each other.
 *
 * Two of these are governance-mutable storage, not constants:
 * `minNetDebt` and the borrowing rate. They are read from the chain at the
 * moment they are used rather than baked in here, because a hardcoded copy
 * would keep pricing a loan the protocol no longer offers.
 */
export const activeBorrow = activeMezo.borrow;

/** Optional RPC override (e.g. a paid endpoint) via env. */
export const RPC_URL =
  process.env.NEXT_PUBLIC_MEZO_RPC_URL ||
  activeChain.rpcUrls.default.http[0];

export const EXPLORER_URL =
  activeChain.blockExplorers?.default.url ?? "https://explorer.mezo.org";
