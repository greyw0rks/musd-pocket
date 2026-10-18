/**
 * Display formatting for Pocket.
 *
 * Pure functions only — no state, no imports from the payment layer beyond
 * the money helpers in `features/payments/amount`, which keep amounts as
 * integers all the way to the point of rendering.
 */

import { formatUnits } from "@/features/payments/amount";
import type {
  PaymentDirection,
  PaymentStatus,
} from "@/features/payments/payment.types";

/** "$1,234.56" */
export function formatMoney(units: bigint): string {
  return `$${formatUnits(units)}`;
}

/** "+$120.00" / "−$42.50" — the sign carries the direction at a glance. */
export function formatSignedMoney(
  units: bigint,
  direction: PaymentDirection,
): string {
  return `${direction === "received" ? "+" : "−"}${formatMoney(units)}`;
}

/**
 * An amount in its own token: "$1,234.56", or "0.005 BTC".
 *
 * Defined in `features/payments/asset-amount.ts` and re-exported here, because
 * the same choice that picks the formatter also picks the parser, and the two
 * are wrong in the same way if they ever disagree. Keeping them in one module is
 * what stops that; this line is only so the usual place to look for a display
 * helper still finds one.
 *
 * The asset is a parameter rather than an assumption because `amountUnits` means
 * different things per asset — hundredths of MUSD, wei of BTC — and the two only
 * look alike. A BTC figure sent through `formatMoney` is wrong by a factor of
 * 10¹⁶ and still prints as a plausible dollar amount, which is the kind of wrong
 * that gets believed; naming the asset at every call site is what makes choosing
 * the formatter a decision instead of an oversight.
 *
 * BTC carries its symbol and MUSD carries its `$` so that a figure always says
 * which token it is. Neither is optional, and that is the point: the number
 * alone does not identify itself.
 */
export { formatAssetAmount, formatSignedAssetAmount } from "@/features/payments/asset-amount";

/** Up to two initials, for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic avatar tone.
 *
 * The same person always looks the same, and the colour doubles as the
 * fallback disc behind a portrait that has not loaded.
 */
const AVATAR_TONES = [
  "bg-emerald-500/85 text-emerald-950",
  "bg-sky-500/85 text-sky-950",
  "bg-amber-400/90 text-amber-950",
  "bg-violet-500/85 text-violet-950",
  "bg-rose-500/85 text-rose-950",
  "bg-teal-400/90 text-teal-950",
  "bg-orange-500/85 text-orange-950",
  "bg-indigo-500/85 text-indigo-950",
] as const;

export function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
};
