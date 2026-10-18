/**
 * The two tokens' amounts, read and written.
 *
 * `amountUnits` holds a number whose *unit* is decided by a field somewhere
 * else, and the two possible units are 10¹⁶ apart. That is the whole reason
 * this module exists: the amount and its asset have to be handled together, by
 * one function that knows both, rather than by a call site that has the number
 * and has to remember which token it came from.
 *
 * Both directions are here so they cannot drift:
 *
 *  - **out** — MUSD is hundredths of a dollar (`features/payments/amount.ts`,
 *    `DISPLAY_DECIMALS = 2`) and is rendered with its `$`; BTC is wei, rendered
 *    to its eight meaningful places by `borrow-format.ts` and labelled `BTC`.
 *  - **in** — which parser a stored amount needs. A MUSD row read with
 *    `parseBtc` would come back rounded to a satoshi; a BTC row read with
 *    `parseDecimalToUnits` would come back **zero**, because eight decimals are
 *    more than that parser accepts and it refuses rather than truncating.
 *
 * Both of those are silent: neither throws, and both print as a plausible
 * figure. Neither is a mistake a reader can spot on the screen, which is why
 * the choice is made once, here, and tested.
 *
 * Pure and dependency-free beyond the two parsers it joins, so it can be tested
 * directly with `node --experimental-strip-types`. The imports below carry
 * explicit `.ts` extensions for that reason and no other — `allowImportingTsExtensions`
 * is on in `tsconfig.json` for exactly this case.
 */

import { formatUnits, parseDecimalToUnits } from "./amount.ts";
import { formatBtc, parseBtc } from "../../lib/mezo/borrow-format.ts";
import type { PaymentAsset, PaymentDirection } from "./payment.types.ts";

/**
 * A stored amount in its own token: `"$1,234.56"`, or `"0.005 BTC"`.
 *
 * The symbol is not decoration. A bare figure in a list that holds two tokens
 * does not say which one it counts, and the reader has no way to find out — so
 * every amount this returns carries the token it is denominated in.
 *
 * The MUSD branch spells out its own `$` instead of calling `formatMoney` from
 * `lib/formatters.ts`. That looks like duplication and is the opposite: this
 * module is re-exported *from* `formatters`, so importing back would be a cycle.
 */
export function formatAssetAmount(asset: PaymentAsset, units: bigint): string {
  return asset === "BTC" ? `${formatBtc(units)} BTC` : `$${formatUnits(units)}`;
}

/** The same, with the direction as a leading sign. */
export function formatSignedAssetAmount(
  asset: PaymentAsset,
  units: bigint,
  direction: PaymentDirection,
): string {
  return `${direction === "received" ? "+" : "−"}${formatAssetAmount(asset, units)}`;
}

/**
 * A stored amount string → minor units of its own token, or null.
 *
 * Null means "this is not a number in that token", never "zero" — the callers
 * treat the two differently, and collapsing them is how a real transfer gets
 * filed as nothing.
 */
export function parseAssetAmount(
  asset: PaymentAsset,
  text: string,
): bigint | null {
  return asset === "BTC" ? parseBtc(text) : parseDecimalToUnits(text);
}
