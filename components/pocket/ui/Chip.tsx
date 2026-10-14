"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A selectable pill.
 *
 * Used for filters, categories and quick amounts. Selection is carried by
 * fill, not by a border colour: the chosen chip is the inverse fill and the
 * rest are plain surfaces, so a row of them needs no other signal for which is
 * chosen — and it is the same contrast that makes a primary button read as
 * primary, which is worth having be one idea rather than two.
 *
 * Scrolls horizontally when it overflows, with the scrollbar hidden, because
 * a row of five chips does not fit a 400px column and wrapping them shoves the
 * content below down by a whole row.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  surface: _surface,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
}) {
  const interactive = Boolean(onClick);

  const shell = cn(
    "pk-chip inline-flex items-center gap-1.5",
    selected && "pk-chip--on",
    !interactive && "cursor-default",
    className,
  );

  if (!interactive) return <span className={shell}>{children}</span>;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={selected}
      className={shell}
    >
      {children}
    </motion.button>
  );
}

/**
 * A horizontally scrolling row of chips, with the scrollbar hidden.
 *
 * The negative margin lets the row bleed to the screen edge while its first
 * chip stays aligned to the page gutter — so the row reads as scrollable
 * instead of as clipped.
 */
export function ChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pk-chips -mx-5 px-5", className)}>{children}</div>
  );
}
