"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Rows, sections and groups.
 *
 * Settings, payment history and contact lists are all the same shape — a
 * leading slot, a title with an optional subtitle, and a trailing slot — so
 * they share one component rather than three near-identical ones.
 *
 * A row is only pressable when it has somewhere to go, which is what `onPress`
 * decides. That is the same rule the rest of the app follows: no press
 * feedback on a control that does nothing.
 *
 * Rows no longer draw dividers. The reference separated them with one, and on
 * a flat opaque card a hairline at 8% is barely visible anyway — so the
 * separation is carried by the leading disc instead, which every row that has
 * more than one has. A row without a disc is a row that stands alone.
 */
export function ListGroup({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pk-group", className)}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <div className="pk-card !px-4 !py-0">{children}</div>
    </section>
  );
}

export function SectionLabel({
  children,
  surface: _surface,
  className,
}: {
  children: ReactNode;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
}) {
  return <p className={cn("pk-m font-semibold uppercase", className)}>{children}</p>;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  surface: _surface,
  className,
  as = "button",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
  /** Rows that only display information render as a plain element. */
  as?: "button" | "div";
}) {
  const interactive = Boolean(onPress);

  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}

      <span className="pk-f">
        <b className="truncate text-[14px]">{title}</b>
        {subtitle ? (
          // Two lines rather than one. Several rows use the subtitle to say
          // what is *not* true yet ("no wallet exists, so there is no address
          // to show"), and truncating that cuts off exactly the half that
          // matters.
          <span className="pk-m mt-0.5 block line-clamp-2">{subtitle}</span>
        ) : null}
      </span>

      {trailing ? (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      ) : null}
    </>
  );

  if (!interactive || as === "div") {
    return <div className={cn("pk-li pk-li--static", className)}>{body}</div>;
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onPress}
      className={cn("pk-li w-full text-left outline-none", className)}
    >
      {body}
    </motion.button>
  );
}
