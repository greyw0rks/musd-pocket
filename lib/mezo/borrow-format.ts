/**
 * Rendering — and reading back — Mezo's 18-decimal chain values.
 *
 * Borrow's figures are all 18-decimal chain values, and they cannot go through
 * `features/payments/amount.ts`'s `formatUnits`: that one takes the app's
 * *2-decimal minor units*, so handing it a wei value would print every figure
 * with sixteen extra zeros — a $2.00 debt rendered as $20,000,000,000,000,000.
 * They are different unit systems and this module is the second one's.
 *
 * BTC is the other 18-decimal value here and it is not Borrow's, which is why
 * the module is named for the unit system rather than for the screen that
 * needed it first: `formatBtc` and `parseBtc` are the pair that turns a typed
 * `0.001` into wei and back, and they are the only two places in the app that
 * know a BTC amount has eight meaningful decimal places.
 *
 * Pure and dependency-free, so it can be tested directly.
 *
 * **The rounding direction is chosen per figure, not by default.** Truncating
 * is right for money the user holds — never show more than there is. It is
 * *wrong* for the liquidation price, where a rounded-down figure reads as
 * "your collateral is safe until $68,412" when the real threshold is a hair
 * above that. Every figure here picks the direction that cannot flatter the
 * position, and says which and why.
 */

/**
 * The decimal places money has, in the app's money.
 *
 * Mezo's native token carries 18, but everything below the eighth is smaller
 * than a satoshi — precision the chain keeps and a balance does not. Both the
 * formatter and the parser stop here so that a figure the app prints can be
 * typed back in unchanged.
 */
export const BTC_DECIMALS = 8;

/** 1 BTC in wei — the scale between what the user types and what is signed. */
const WEI_PER_BTC = 10n ** 18n;

/** Divide by 10^decimals, sending the remainder down or up. */
function shift(
  value: bigint,
  decimals: number,
  round: "down" | "up",
): bigint {
  const scale = 10n ** BigInt(decimals);
  const q = value / scale;
  if (round === "up" && value % scale !== 0n) return q + 1n;
  return q;
}

/**
 * A 18-decimal value as a plain decimal string with `decimals` places.
 *
 * Magnitude is preserved through `shift` first so the string assembly below
 * only ever deals with a small integer — concatenating a 25-digit wei value
 * straight into a string is how a three-digit number acquires a sixteen-digit
 * tail.
 */
function fixed(
  value: bigint,
  decimals: number,
  round: "down" | "up" = "down",
): string {
  const scaled = shift(value, 18 - decimals, round);
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const base = 10n ** BigInt(decimals);

  const whole = abs / base;
  const frac = abs % base;
  const sign = negative ? "-" : "";

  if (decimals === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${frac.toString().padStart(decimals, "0")}`;
}

/** Strip trailing zeros from a fixed string: "0.00021000" → "0.00021". */
function trim(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

/**
 * BTC, to satoshi resolution.
 *
 * Eight places and no padding: Mezo's native gas token carries 18 decimals but
 * the last ten are below a satoshi, and "0.000210000000000000" is precision the
 * chain has and money does not. Matches `btcAmount` in `hooks/use-live-wallet.ts`
 * so a collateral figure and a gas balance are written the same way.
 *
 * Truncated: collateral is money the user has, and rounding it up would claim
 * more is locked than is.
 */
export function formatBtc(wei: bigint): string {
  return trim(fixed(wei, BTC_DECIMALS, "down"));
}

/**
 * Parse a typed BTC amount back into wei — the inverse of `formatBtc`.
 *
 * Returns `null` for anything that is not a well-formed amount, including an
 * empty string, a bare ".", a negative, and **more decimals than money has**.
 * The last one is a refusal rather than a truncation on purpose: silently
 * dropping the ninth decimal of a typed amount would sign a transfer for
 * slightly less than the user asked for, and a number they can see is wrong is
 * better than one that is quietly rounded.
 *
 * `null` is not zero, and a caller must not treat it as one — an unparseable
 * amount is not a request to send nothing.
 */
export function parseBtc(text: string): bigint | null {
  if (!/^\d*\.?\d*$/.test(text)) return null;
  if (text === "" || text === ".") return null;

  const [whole, frac = ""] = text.split(".");
  if (frac.length > BTC_DECIMALS) return null;

  const padded = frac.padEnd(18, "0");
  return (whole === "" ? 0n : BigInt(whole)) * WEI_PER_BTC + BigInt(padded);
}

/** MUSD, to the app's two display decimals. Truncated, for the same reason. */
export function formatMusd(wei: bigint): string {
  return fixed(wei, 2, "down");
}

/**
 * A USD-per-BTC price, from an 18-decimal oracle value.
 *
 * Rounded **up** when it is a liquidation threshold — see `formatLiquidationPrice`
 * — and down otherwise. `null` is not a zero: an unread price is rendered as an
 * em dash by the screen, because "$0.00" over a live position would read as
 * "Bitcoin is worthless" rather than "the oracle did not answer".
 */
export function formatUsd(price18: bigint | null, round: "down" | "up" = "down"): string {
  if (price18 === null) return "—";
  const text = fixed(price18, 2, round);
  // Thousands separators, hand-rolled: `toLocaleString` is locale-dependent and
  // would render differently on a server and a phone.
  const [whole, frac] = text.split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

/**
 * The BTC price at which this position can be liquidated.
 *
 * Rounded **up**, which is the opposite of every other figure here. The
 * displayed number is a warning, and a warning that understates itself is
 * worse than useless: at a truncated $68,412 the user believes they have room
 * down to that price, when liquidation actually begins marginally above it.
 * Erring high costs nothing and never tells someone they are safer than they
 * are.
 */
export function formatLiquidationPrice(price18: bigint | null): string {
  return formatUsd(price18, "up");
}

/**
 * A ratio or LTV as a percentage, e.g. "271.4%".
 *
 * One decimal place. Truncated, because a collateral ratio is the figure the
 * user reads as "how much room do I have" — rounding 149.96% up to 150.0% would
 * show a position clearing the 150% critical ratio when it does not.
 */
export function formatRatio(ratio18: bigint | null): string {
  if (ratio18 === null) return "—";
  // 1e18 is 100%, so 1e15 is a tenth of a percent.
  const tenths = shift(ratio18, 15, "down");
  const whole = tenths / 10n;
  const frac = tenths % 10n;
  return `${whole}.${frac}%`;
}

/**
 * A collaterisation threshold (MCR 110%, CCR 150%) as a percentage.
 *
 * Zero decimals, since these are round protocol constants.
 */
export function formatThreshold(ratio18: bigint): string {
  return `${shift(ratio18, 16, "down")}%`;
}
