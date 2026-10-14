"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/pocket/ui/Spinner";

/**
 * The one button.
 *
 * Four variants, and three of them are decided by *fill* rather than by colour
 * — which is the whole change from the previous pass. A translucent control
 * over a light background has to lean on a border to be seen at all, and the
 * app now has two backgrounds; two borders that each only work in one theme is
 * two chances to get it wrong. So every variant is opaque and resolves its
 * colours from the token block:
 *
 *  - `primary` is the inverse fill — black in the light theme, white in the
 *    dark one. It is the only control on a screen that moves money, and the
 *    one that inverts is the one that reads as loudest in both.
 *  - `secondary` is a plain card surface: quiet, still pressable.
 *  - `purple` is the brand fill. It exists because the reference reaches for
 *    it in exactly one place — the Borrow call to action — and a button that
 *    is the only one of its kind should be a variant rather than a one-off
 *    class at the call site.
 *  - `ghost` is text.
 *  - `danger` is red, and is never the default action.
 *
 * The `surface` prop is accepted and ignored. It used to pick between a white
 * and a stone set, which was a workaround for a palette that could not invert;
 * the tokens do that now, and every call site that still passes it is one the
 * re-skin has not reached yet.
 */
export type ButtonSurface = "dark" | "light";

const VARIANTS = {
  primary: "pk-btn",
  secondary: "pk-btn pk-btn--alt",
  purple: "pk-btn pk-btn--pu",
  ghost:
    "text-[var(--m)] hover:text-[var(--t)] bg-transparent shadow-none",
  danger: "pk-btn pk-btn--rd",
} as const;

/** The filled variants take the pill recipe; ghost must not. */
const SHAPE = {
  primary: "",
  secondary: "",
  purple: "",
  ghost: "",
  danger: "",
} as const;

const SIZES = {
  sm: "h-9 min-h-0 px-4 text-[12px]",
  md: "h-11 min-h-0 px-5 text-[13px]",
  lg: "",
} as const;

export function Button({
  children,
  variant = "primary",
  surface: _surface,
  size = "md",
  full = false,
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: {
  children?: ReactNode;
  variant?: keyof typeof VARIANTS;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: ButtonSurface;
  size?: keyof typeof SIZES;
  full?: boolean;
  loading?: boolean;
  icon?: ReactNode;
} & Omit<ComponentProps<typeof motion.button>, "children">) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      disabled={isDisabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[27px] outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:cursor-not-allowed",
        variant === "ghost"
          ? "h-10 px-3 text-[13px] font-semibold"
          : "font-semibold",
        SIZES[size],
        SHAPE[variant],
        VARIANTS[variant],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner className="!size-4 !border-2" />
      ) : (
        icon
      )}
      {children}
    </motion.button>
  );
}

/**
 * The circular icon button — a back arrow, a bell, a close.
 *
 * Its own component because it appears on nearly every screen and its geometry
 * (a 44px disc) is not a size of `Button`. It sits on `--s`, one step up from
 * the page, so a screen can have three of them in a row without any of them
 * looking like a hole.
 */
export function IconButton({
  children,
  label,
  surface: _surface,
  className,
  ...props
}: {
  children: ReactNode;
  label: string;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: ButtonSurface;
} & Omit<ComponentProps<typeof motion.button>, "children">) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 460, damping: 22 }}
      aria-label={label}
      title={label}
      className={cn("pk-ib outline-none", className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
