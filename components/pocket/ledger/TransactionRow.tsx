"use client";

import { motion } from "motion/react";
import { Avatar } from "@/components/pocket/Avatar";
import { useMounted } from "@/components/pocket/ui/useMounted";
import {
  formatSignedAssetAmount,
  PAYMENT_STATUS_LABEL,
} from "@/lib/formatters";
import { cn, relativeTime } from "@/lib/utils";
import type { Transaction } from "@/features/payments/payment.types";

/**
 * One ledger entry.
 *
 * Shared by home and the full transactions list so the same payment cannot
 * look like two different things depending on where it is read.
 *
 * The row is the reference's `.li`: a disc, a title with a caption under it,
 * and the amount hard right. What differs from the reference is the disc — it
 * is the counterparty's portrait rather than a category glyph. The reference
 * grouped transactions by what they were *for*, which it could do because it
 * invented them; this ledger knows who a payment went to and not what it was
 * for, and a made-up category on a real counterparty is the one kind of
 * decoration that would be actively misleading.
 *
 * The caption under the amount is the payment's *status*, not its provenance.
 * It used to read "Demo", which was a label this build no longer earns — money
 * now moves on a chain. What a reader of a list actually needs is whether the
 * row settled: a `pending` transfer is submitted and not confirmed, and saying
 * so on the row is the difference between a record and a claim.
 */
export function TransactionRow({
  tx,
  portrait,
  groupedDay = false,
  highlighted = false,
  onPress,
}: {
  tx: Transaction;
  /** The counterparty's current portrait, looked up by the caller. */
  portrait?: string;
  /**
   * Whether a day heading sits directly above this row.
   *
   * A property of the list, not of the row, so the caller states it rather
   * than the row trying to infer it from its own colours. Home is ungrouped
   * and needs the age on every row; the full list has headings and does not
   * want the same word twice.
   */
  groupedDay?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
}) {
  const mounted = useMounted();
  const received = tx.direction === "received";

  const stamp = mounted
    ? groupedDay
      ? rowStamp(tx.createdAt)
      : relativeTime(tx.createdAt)
    : "";

  const body = (
    <>
      <Avatar name={tx.recipientName} src={portrait} size={40} />

      <div className="pk-f">
        <b className="truncate text-[14px]">
          {received ? "From" : "To"} {tx.recipientName}
        </b>
        <span className="pk-m block truncate">
          {tx.recipientHandle}
          {/* The clock is the client's. Rendering it before mount would put a
              different string on the server than on the first paint. */}
          {stamp ? ` · ${stamp}` : ""}
        </span>
      </div>

      <div className="shrink-0 text-right">
        <span
          className={cn(
            "block text-[14px] font-semibold tabular-nums",
            received && "pk-pos",
          )}
        >
          {/*
            Formatted by the row's own asset, not by the app's money unit. This
            list holds two tokens and `amountUnits` is denominated in whichever
            one the row names, so the figure is rendered through `tx.asset` —
            the alternative is a BTC transfer printed as a dollar amount.
          */}
          {formatSignedAssetAmount(tx.asset, tx.amountUnits, tx.direction)}
        </span>
        <span className="pk-m block">{PAYMENT_STATUS_LABEL[tx.status]}</span>
      </div>
    </>
  );

  const shell = cn(
    "pk-li w-full",
    highlighted && "bg-[color-mix(in_srgb,var(--g)_14%,transparent)]",
  );

  if (!onPress) {
    return <div className={cn(shell, "pk-li--static")}>{body}</div>;
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onPress}
      className={cn(shell, "text-left outline-none")}
    >
      {body}
    </motion.button>
  );
}

/**
 * The day a payment belongs to, as a person would say it.
 *
 * "Today" and "Yesterday" rather than a date, because the question the header
 * answers is "how far back am I looking", and a date makes the reader do that
 * subtraction themselves. Older entries do get a date, where it is the more
 * useful fact.
 */
export function dayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const then = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();

  const days = Math.round((today - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/**
 * The age of a row that sits under a day heading.
 *
 * A row reading "Yesterday" beneath a heading reading "YESTERDAY" is the same
 * fact stated twice, so when the two agree the row says nothing and the heading
 * carries it. They can only disagree once the elapsed time and the calendar
 * have drifted apart, which is why `relativeTime` counts in calendar days past
 * the hour mark.
 *
 * Returns an empty string when there is nothing to add, so callers can drop the
 * element rather than render a blank one.
 */
export function rowStamp(date: Date): string {
  const age = relativeTime(date);
  return age === dayLabel(date) ? "" : age;
}
