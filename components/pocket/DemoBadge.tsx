"use client";

import { cn } from "@/lib/utils";

/**
 * The honesty marker.
 *
 * The reference design labels nothing, so this is deliberately the smallest
 * thing that can do the job: a dot and a word, sitting next to the number it
 * qualifies. It is not a banner, and it never competes with the amount.
 *
 * It is the one piece of the reference that is *not* copied, on purpose. Every
 * figure in the reference reads as a funded wallet — a balance, a completed
 * payment, a borrowing limit — and Pocket has none of that until Mezo is
 * wired. So the marker rides along with anything that looks like money, and it
 * says what the number is rather than hiding it.
 *
 * `tone` picks the ink, because the marker sits on three different surfaces:
 * the page, the purple card, and the yellow one.
 */
export function DemoBadge({
  label = "Demo",
  tone = "page",
  className,
}: {
  label?: string;
  tone?: "page" | "onPurple" | "onYellow" | "onInverse";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide",
        tone === "page" && "text-[var(--m)]",
        tone === "onPurple" && "text-white/60",
        tone === "onYellow" && "text-black/55",
        tone === "onInverse" && "text-[var(--invt)]/60",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
