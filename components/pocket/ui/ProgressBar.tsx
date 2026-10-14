"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A goal, as a bar.
 *
 * Takes money rather than a percentage, so the caller cannot pass a number
 * that disagrees with the figures printed next to the bar, and so the
 * impossible cases are handled once: a goal of zero, a saved amount with no
 * goal, and saving past the goal all resolve here rather than at three call
 * sites.
 *
 * `tone` picks the ink because the bar is used on two surfaces — the purple
 * vault card, where it is white on a white wash, and the page, where it is
 * brand purple on the recessed surface.
 */
export function ProgressBar({
  value,
  max,
  tone = "page",
  label,
  className,
}: {
  /** Amount saved, in minor units. */
  value: bigint;
  /** The goal, in minor units. Zero means no goal is set. */
  max: bigint;
  tone?: "page" | "onPurple";
  /** What a screen reader hears. The bar itself says nothing. */
  label: string;
  className?: string;
}) {
  const percent = percentOf(value, max);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        tone === "onPurple" ? "bg-white/25" : "bg-[var(--s2)]",
        className,
      )}
    >
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24, delay: 0.2 }}
        className={cn(
          "block h-full rounded-full",
          tone === "onPurple" ? "bg-white" : "bg-[var(--p)]",
        )}
      />
    </div>
  );
}

/**
 * Saved as a whole percentage of the goal, clamped to 0–100.
 *
 * Zero is the answer to both halves of "no goal" — nothing saved, and nothing
 * to save towards — which is why the two cases collapse here rather than
 * needing a branch above.
 */
function percentOf(value: bigint, max: bigint): number {
  if (max <= 0n) return 0;
  if (value <= 0n) return 0;

  const percent = Math.round((Number(value) / Number(max)) * 100);
  return Math.min(Math.max(percent, 0), 100);
}
