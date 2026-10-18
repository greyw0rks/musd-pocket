import type { Address } from "viem";
import { activeBorrow } from "./config";
import { getPublicClient } from "./musd";
import {
  collateralRatio,
  loanToValue,
  liquidationPrice,
  troveHealth,
  type TroveHealth,
} from "./borrow-math";

/**
 * Read-only window into a borrower's Mezo Borrow position (a "Trove").
 *
 * Mezo Borrow is the MUSD CDP — a Liquity v1 fork where a position is BTC
 * collateral locked against MUSD debt. Pocket never opens or touches a Trove
 * here; this module only *reads* one so the app can show a signed-in user how
 * their Bitcoin-backed credit line is doing. Signing lives in `borrow-write.ts`
 * and happens in the user's own wallet.
 *
 * Mirrors the `vault.ts` shape: const ABIs, addresses from the config
 * single-source, reads through the shared public client. Client- and
 * server-safe — no private key, no `server-only`. The Pocket relayer is
 * deliberately absent: a Trove belongs to the address that opened it
 * (`msg.sender` is the borrower), so it is the user's wallet that authorizes
 * every change and nothing here can act for them.
 */

const TM = activeBorrow.troveManager;
const PRICE_FEED = activeBorrow.priceFeed;

// Only the TroveManager view functions Pocket needs to render health. The real
// contract has no single `debt` field (debt = principal + interestOwed +
// accrued interest); `getTroveDebt` folds those together, and `getTroveColl`
// returns the stored collateral — both are what a healthy single position
// shows. `MCR` is an immutable 110% (1e18-scaled) constant inherited from
// LiquityBase.
//
// These four reads were exercised against the deployed contracts on both
// networks: each answered 0 for an address with
// no Trove, which is the value a non-existent position should have and not the
// generic failure a wrong selector produces. Both sides are EIP-1967 proxies,
// so the implementation behind the proxy is what carries the dispatcher.
export const TROVE_MANAGER_ABI = [
  {
    type: "function",
    name: "getTroveStatus",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "getTroveColl",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getTroveDebt",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getCurrentICR",
    stateMutability: "view",
    inputs: [
      { name: "_borrower", type: "address" },
      { name: "_price", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "MCR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  /*
    Not part of rendering the position — recovery mode is a property of the
    whole system, not of one Trove — but the *close* path cannot be honest
    without it. `BorrowerOperations.closeTrove()` calls
    `_requireNotInRecoveryMode(price)` whenever `canMint`, which is the ordinary
    case, so a healthy position can be unclosable for a reason that has nothing
    to do with the borrower. Without this read the refusal would have to be the
    generic "could not be checked against the chain", which reads like a bug.

    Verified present in the deployed implementation on both networks (selector
    4e443d9e in the EIP-1967 impl, and
    answering `false` on both at the time of writing).
  */
  {
    type: "function",
    name: "checkRecoveryMode",
    stateMutability: "view",
    inputs: [{ name: "_price", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// PriceFeed.fetchPrice() is a *view* in the Mezo fork (reads Chainlink
// latestRoundData, scales to 18 decimals) — but it reverts if the oracle is
// stale (>60s). There is no `lastGoodPrice()` getter to fall back on, which is
// why the caller below treats a throw as "no price" rather than as an error.
export const PRICE_FEED_ABI = [
  {
    type: "function",
    name: "fetchPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Trove.Status enum order. */
export const TROVE_STATUS = {
  0: "nonExistent",
  1: "active",
  2: "closedByOwner",
  3: "closedByLiquidation",
  4: "closedByRedemption",
} as const;

export type BorrowPosition = {
  /** True only when the Trove is open (status === active). */
  hasTrove: boolean;
  status: number;
  statusLabel: string;
  /** BTC collateral, 18-decimal wei. */
  collateral: bigint;
  /** MUSD debt, 18-decimal wei — includes accrued interest + the 200 MUSD reserve. */
  debt: bigint;
  /** USD per 1 BTC, 18-decimal. Null when the oracle is unavailable/stale. */
  price: bigint | null;
  /** Minimum collateral ratio (110%), 1e18 = 100%. */
  mcr: bigint;
  collateralRatio: bigint | null;
  ltv: bigint | null;
  liquidationPrice: bigint | null;
  health: TroveHealth;
};

/**
 * Read one borrower's position and derive its health. The borrower is the
 * user's own embedded-wallet address — the account that would hold the Trove
 * if they've borrowed on Pocket's wallet.
 *
 * Degrades rather than throwing when the price oracle is stale: coll/debt
 * still render, the price-derived metrics go null. That matters because the
 * oracle reverts on its own schedule (a quiet minute is enough), and a
 * dashboard that vanishes when the price feed blinks is worse than one that
 * shows the collateral it does know about and withholds the rest.
 */
export async function getBorrowPosition(
  borrower: Address,
): Promise<BorrowPosition> {
  const client = getPublicClient();

  const [status, coll, debt, mcr] = await Promise.all([
    client.readContract({
      address: TM,
      abi: TROVE_MANAGER_ABI,
      functionName: "getTroveStatus",
      args: [borrower],
    }),
    client.readContract({
      address: TM,
      abi: TROVE_MANAGER_ABI,
      functionName: "getTroveColl",
      args: [borrower],
    }),
    client.readContract({
      address: TM,
      abi: TROVE_MANAGER_ABI,
      functionName: "getTroveDebt",
      args: [borrower],
    }),
    client.readContract({
      address: TM,
      abi: TROVE_MANAGER_ABI,
      functionName: "MCR",
      args: [],
    }),
  ]);

  let price: bigint | null = null;
  try {
    price = await client.readContract({
      address: PRICE_FEED,
      abi: PRICE_FEED_ABI,
      functionName: "fetchPrice",
      args: [],
    });
  } catch {
    price = null;
  }

  const statusNum = Number(status);
  const active = statusNum === 1;

  const ratio = active && price !== null ? collateralRatio(coll, debt, price) : null;
  const ltv = active && price !== null ? loanToValue(coll, debt, price) : null;
  const liq = active ? liquidationPrice(coll, debt, mcr) : null;

  return {
    hasTrove: active,
    status: statusNum,
    statusLabel:
      TROVE_STATUS[statusNum as keyof typeof TROVE_STATUS] ?? "unknown",
    collateral: coll,
    debt,
    price,
    mcr,
    collateralRatio: ratio,
    ltv,
    liquidationPrice: liq,
    health: troveHealth(ratio, mcr),
  };
}
