"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { BackIcon } from "@/components/pocket/icons";
import { cn } from "@/lib/utils";

/**
 * The header every pushed screen wears.
 *
 * The back disc on the left, a centred title, an optional trailing slot. It is
 * `.pk-bar` from the stylesheet, which is why the header sits at the same
 * height on every screen without any of them setting a height.
 *
 * The back arrow is a filled disc rather than a bare glyph — it is the only
 * way off the screen and it sits in the top-left corner where the eye lands
 * first, so it gets a target rather than a stroke.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
  surface: _surface,
  className,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
}) {
  return (
    <header className={cn("pk-bar", className)}>
      {/*
        The two corner slots share the leftover width equally (`flex-1 basis-0`)
        rather than each being a fixed 44px. That is what keeps the title
        genuinely centred once a slot holds something wider than a disc — the
        send screen's "Ask" pill is the case that forced it — while still
        reserving a disc's worth of space when a slot is empty.
      */}
      <div className="flex min-w-11 flex-1 basis-0 items-center justify-start">
        {onBack ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            onClick={onBack}
            aria-label="Back"
            className="pk-ib outline-none"
          >
            <BackIcon size={22} />
          </motion.button>
        ) : null}
      </div>

      <div className="min-w-0 shrink text-center">
        <h1 className="pk-h2 truncate">{title}</h1>
        {subtitle ? <p className="pk-m truncate">{subtitle}</p> : null}
      </div>

      <div className="flex min-w-11 flex-1 basis-0 items-center justify-end">
        {action}
      </div>
    </header>
  );
}

/**
 * The large left-aligned page heading.
 *
 * Screens that are a *place* rather than a push use this instead of
 * `ScreenHeader` — Vault and Spending both do, and so does the recipient list.
 */
export function PageHeading({
  title,
  action,
  surface: _surface,
  className,
}: {
  title: string;
  action?: ReactNode;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("pk-row pk-sp", className)}>
      <h1 className="pk-h1">{title}</h1>
      {action}
    </div>
  );
}
