/**
 * Trove health math — pure, no I/O, no ABI.
 *
 * A Mezo Borrow position (Liquity v1 fork) is three numbers: BTC collateral,
 * MUSD debt, and the oracle BTC price. Everything Pocket shows on the borrow
 * dashboard — collateral ratio, LTV, how close you are to liquidation — is
 * derived from those three. Keeping the derivation here (rather than in the
 * read module or the component) means the on-chain reads can change shape
 * without touching the arithmetic, and the arithmetic can be unit-tested in
 * isolation.
 *
 * Units: every value is an 18-decimal fixed-point bigint, matching the chain.
 *   - `coll`  — BTC, wei (1e18 = 1 BTC)
 *   - `debt`  — MUSD, wei (1e18 = 1 MUSD); this is the *entire* debt including
 *               the 200 MUSD gas-compensation reserve, which is what the
 *               liquidation check uses.
 *   - `price` — USD per 1 BTC, scaled 1e18 (1e18 = $1.00). Mezo's PriceFeed
 *               returns 18 decimals.
 *   - ratios  — 1e18 = 100%. So an MCR of 110% is 1_100_000_000_000_000_000n.
 *
 * These are chain units, not the app's 2-decimal display units
 * (`features/payments/amount.ts`). The conversion belongs at the edge where a
 * figure becomes a string; doing it in here would round the intermediate terms
 * and make a ratio depend on how it was last displayed.
 */

const WAD = 1_000_000_000_000_000_000n; // 1e18

/*
  Two protocol constants, here rather than beside the ABIs that use them.

  They are plain numbers with no ABI and no address attached, and putting them
  in this file is what keeps them reachable from a test: everything in
  `borrow-write.ts` transitively imports `viem/chains`, which a bare `node` run
  cannot resolve, so a constant defined there can only be checked by eye.
  `borrow-write.ts` re-exports both, so nothing that already imported them from
  there has to change.

  Neither is governance-mutable — unlike `minNetDebt` and the borrowing rate,
  which the form reads from the chain at the moment of use.
*/

/**
 * The gas-compensation reserve folded into every Trove's debt, 18-decimal wei.
 * Immutable in the Mezo fork, inherited from LiquityBase, and confirmed by
 * reading `MUSD_GAS_COMPENSATION()` off the deployed contract on both networks.
 *
 * It is the reason a position has three debts rather than one: this is added to
 * the net debt to form the *composite* debt that the collateral ratio is
 * computed from, and it is what the borrower is *not* charged on the way out —
 * a close burns it from the protocol's gas pool, not from their wallet.
 */
export const MUSD_GAS_COMPENSATION = 200n * WAD;

/**
 * Critical Collateral Ratio, 1e18 = 100%. An immutable 150% in the fork, read
 * back off the deployed TroveManager on both networks.
 *
 * The protocol only *requires* the MCR (110%) in normal operation, and switches
 * to requiring this one while in recovery mode. Pocket uses the stricter of the
 * two as its opening floor — see `open()` in `borrow-actions.ts`.
 */
export const CCR = 150n * 10n ** 16n;

/** USD value of the collateral, 18-decimal. `coll * price / 1e18`. */
export function collateralValueUsd(coll: bigint, price: bigint): bigint {
  return (coll * price) / WAD;
}

/**
 * Collateral ratio (a.k.a. ICR), 1e18 = 100%. This mirrors the chain's
 * `getCurrentICR`: `coll * price / debt`. Returns `null` for a zero-debt
 * position (ratio is undefined / effectively infinite) so callers render
 * "—" rather than dividing by zero.
 */
export function collateralRatio(
  coll: bigint,
  debt: bigint,
  price: bigint,
): bigint | null {
  if (debt === 0n) return null;
  return (coll * price) / debt;
}

/**
 * Loan-to-value, 1e18 = 100% — the inverse framing of the collateral ratio,
 * the one most spenders think in ("I've borrowed X% of my Bitcoin's value").
 * `debt / collateralValue`. Returns `null` when the collateral is worthless
 * or absent.
 */
export function loanToValue(
  coll: bigint,
  debt: bigint,
  price: bigint,
): bigint | null {
  const value = collateralValueUsd(coll, price);
  if (value === 0n) return null;
  return (debt * WAD) / value;
}

/**
 * The BTC price (USD per 1 BTC, 18-decimal) at which this position's
 * collateral ratio falls to the minimum (MCR) and becomes liquidatable.
 *
 * ICR = coll * price / debt, so solving ICR == MCR for price gives
 * `price = MCR * debt / coll`. Returns `null` when there's no collateral.
 *
 * Below this price the position can be liquidated; the gap between it and the
 * live price is the headroom the dashboard warns on.
 */
export function liquidationPrice(
  coll: bigint,
  debt: bigint,
  mcr: bigint,
): bigint | null {
  if (coll === 0n) return null;
  return (mcr * debt) / coll;
}

/**
 * Classify a position's safety from its collateral ratio relative to the MCR,
 * for colour/label on the dashboard. Thresholds are expressed as a multiple of
 * the MCR so they track the protocol rather than a hard-coded 110%:
 *   - at/below MCR            → "liquidation" (already underwater)
 *   - below 1.5× MCR          → "risky"
 *   - below 2× MCR            → "caution"
 *   - otherwise               → "healthy"
 * A `null` ratio (no debt) is "healthy" — nothing to lose.
 */
export type TroveHealth = "healthy" | "caution" | "risky" | "liquidation";

export function troveHealth(ratio: bigint | null, mcr: bigint): TroveHealth {
  if (ratio === null) return "healthy";
  if (ratio <= mcr) return "liquidation";
  if (ratio < (mcr * 3n) / 2n) return "risky";
  if (ratio < mcr * 2n) return "caution";
  return "healthy";
}

/**
 * The largest repayment the protocol will accept from a Trove, in 18-decimal
 * wei. Returns `0n` when the position is already at the floor — which is the
 * repayment form's signal to stop offering a repayment and offer a close.
 *
 * Read off the deployed `BorrowerOperations.repayMUSD`, which routes into
 * `_adjustTrove` and then runs three checks in order:
 *
 *   `_requireAtLeastMinNetDebt(netDebt - repayment)`   ← the binding one
 *   `_requireValidMUSDRepayment(debt, repayment)`      ← repayment <= debt - 200
 *   `_requireSufficientMUSDBalance(caller, repayment)` ← the wallet holds it
 *
 * Because `netDebt == debt - 200`, the first expands to
 * `repayment <= debt - 200 - minNetDebt`, which is strictly tighter than the
 * second, so the second can never be the one that fires. That is what makes a
 * repayment unable to close a Trove: the debt always stops at the minimum, and
 * closing is the only way past it.
 *
 * `minNetDebt` is an argument rather than a constant because it is
 * governance-mutable storage — the form reads it live.
 */
export function maxRepayable(debt: bigint, minNetDebt: bigint): bigint {
  const net = debt - MUSD_GAS_COMPENSATION;
  return net > minNetDebt ? net - minNetDebt : 0n;
}

/* -------------------------------------------------------------------------- */
/* Typed input ↔ chain wei                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Parse what the user typed into 18-decimal wei.
 *
 * This is the one place in the borrow feature where a number crosses from a
 * person's fingers to the chain, and the app's *other* parser
 * (`features/payments/amount.ts:parseDecimalToUnits`) must not be used here: it
 * produces 2-decimal minor units, and feeding those to `openTrove` would ask
 * the protocol for collateral one ten-quadrillionth of what was typed. So the
 * 18-decimal parse lives here, beside the arithmetic it feeds, and is tested.
 *
 * Returns `null` — never `0n` — for anything that is not a plain non-negative
 * decimal: an empty field, a lone ".", a stray letter, a negative, or more than
 * 18 decimal places. `null` is "this is not a number yet", and a caller must
 * treat it as "not ready to submit" rather than as zero, or a half-typed figure
 * would be submitted as nothing.
 *
 * `.5` and `5.` both parse, because both are things people type.
 */
export function parseDecimalToWei(text: string): bigint | null {
  const t = text.trim();
  if (t === "" || t === ".") return null;
  if (!/^\d*(\.\d*)?$/.test(t)) return null;

  const [whole = "", frac = ""] = t.split(".");
  if (frac.length > 18) return null;

  return BigInt(whole || "0") * WAD + BigInt(frac.padEnd(18, "0") || "0");
}

/**
 * The inverse, for filling a field — a "Max" button, or an amount carried over
 * from a previous step.
 *
 * Full precision and no grouping, because this goes back into an input the user
 * can edit: a rounded `formatBtc` here would silently drop decimal places the
 * chain still holds, which is the same bug as the one above arriving from the
 * other direction. Trailing zeros are trimmed so `.5` reads as `0.5` and `1.0`
 * as `1`.
 */
export function weiToDecimalInput(wei: bigint): string {
  if (wei < 0n) return "0";

  const whole = wei / WAD;
  const frac = (wei % WAD).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
