/**
 * Display formatting for the Pocket demo.
 *
 * Pure functions only — no state, no imports from the payment layer beyond
 * the money helpers in `features/payments/amount`, which keep amounts as
 * integers all the way to the point of rendering.
 */

import { formatUnits } from "@/features/payments/amount";
import type {
  PaymentDirection,
  PaymentKind,
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

/** How a payment's provenance should be described to the user. */
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  demo: "Demo",
  onchain: "On-chain",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
};
