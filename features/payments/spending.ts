/**
 * Spending arithmetic.
 *
 * Pure, and derived entirely from the ledger the UI already has. Nothing here
 * invents a figure: if the ledger is empty then every number this module
 * returns is zero, and the screens above it are expected to say so rather than
 * dress the zeros up.
 *
 * The only place a `bigint` becomes a `number` is chart geometry, where the
 * value is a bar height in user units rather than money. Money itself stays in
 * minor units all the way to the formatter.
 */

import { ONE } from "@/features/payments/amount";
import type { Transaction } from "@/features/payments/payment.types";

/** Midnight on the first of the month the given date falls in. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Midnight on the first of the month after the given date. */
function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/** "October 2026" — the month a statement covers. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export interface MonthSummary {
  /** Everything sent in the reference month, in minor units. */
  spentUnits: bigint;
  /** The same total for the month before it, for the comparison. */
  previousUnits: bigint;
  /**
   * Movement against the previous month, as a whole percentage. Negative is
   * less spent.
   *
   * `null` when the comparison would be meaningless: a month with no prior
   * month to compare to, or a prior month of zero. A change *from nothing* has
   * no percentage — printing "↑ 100%" the first time anyone spends a pound
   * would be a statistic invented out of a division by zero.
   */
  changePct: number | null;
  /** Sent per day of the month, indexed from zero. */
  dailyUnits: bigint[];
  /**
   * The day with the largest spend, or -1 when the month is empty. The chart
   * lights this bar, so the emphasis falls on a fact rather than on a fixed
   * column.
   */
  peakDay: number;
}

/**
 * Summarise one calendar month of outgoing payments.
 *
 * Only `sent` counts. Money arriving is not spending, and a month's spending
 * figure that rises because somebody paid you back would be actively wrong.
 *
 * `pending` and `failed` transfers are counted, because the question the
 * screen answers is "what have I committed this month" — a payment that is
 * still settling has left the balance. Failed ones are *not*, since nothing
 * left.
 */
export function summarizeMonth(
  transactions: readonly Transaction[],
  reference: Date,
): MonthSummary {
  const monthStart = startOfMonth(reference).getTime();
  const monthEnd = startOfNextMonth(reference).getTime();
  const previousStart = new Date(
    reference.getFullYear(),
    reference.getMonth() - 1,
    1,
  ).getTime();

  const dayCount = Math.round(
    (monthEnd - monthStart) / 86_400_000,
  );
  const daily = new Array<bigint>(dayCount).fill(0n);

  let spentUnits = 0n;
  let previousUnits = 0n;

  for (const tx of transactions) {
    if (tx.direction !== "sent") continue;
    if (tx.status === "failed") continue;

    const at = tx.createdAt.getTime();
    if (at >= monthStart && at < monthEnd) {
      spentUnits += tx.amountUnits;
      const day = new Date(tx.createdAt).getDate() - 1;
      if (day >= 0 && day < dayCount) daily[day] += tx.amountUnits;
    } else if (at >= previousStart && at < monthStart) {
      previousUnits += tx.amountUnits;
    }
  }

  let peakDay = -1;
  let peak = 0n;
  daily.forEach((value, day) => {
    if (value > peak) {
      peak = value;
      peakDay = day;
    }
  });

  return {
    spentUnits,
    previousUnits,
    changePct: percentChange(spentUnits, previousUnits),
    dailyUnits: daily,
    peakDay,
  };
}

/**
 * The movement between two totals, rounded to a whole percent.
 *
 * `null` rather than zero when there is nothing to compare against, because
 * "0% change" and "no previous month" are different statements and only one of
 * them is true.
 */
function percentChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  // Both sides are small enough that the ratio is exact in a double well past
  // the point a percentage needs to be.
  const delta = Number(current - previous) / Number(previous);
  return Math.round(delta * 100);
}

/**
 * Bar heights, as fractions of the tallest day.
 *
 * Returned as 0..1 rather than as amounts so the chart does no arithmetic and
 * an all-zero month produces an even row of stubs instead of a division by
 * zero. A day with any spending is never zero-height — a payment that rounds
 * to nothing on the chart would look like a day with no payment, which is the
 * one thing the chart exists to distinguish.
 */
export function barFractions(daily: readonly bigint[]): number[] {
  let peak = 0n;
  for (const value of daily) if (value > peak) peak = value;

  if (peak === 0n) return daily.map(() => 0);

  const scale = Number(peak);
  return daily.map((value) => {
    if (value === 0n) return 0;
    return Math.max(Number(value) / scale, 0.08);
  });
}

/** Amounts in major units, for anything that needs a plain number. */
export function toMajorUnits(units: bigint): number {
  return Number(units) / Number(ONE);
}
