"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { stagger } from "@/components/pocket/theme";
import { formatMoney } from "@/lib/formatters";
import type { Transaction } from "@/features/payments/payment.types";

/** How many calendar months the chart covers, including the current one. */
const MONTHS = 6;

/** The plotting area's height, in px. Bars are drawn as a percentage of it. */
const PLOT_HEIGHT = 76;

/** A bar for a month with spending never draws thinner than this. */
const MIN_BAR_PX = 6;

type Bucket = {
  /** The month as it will be read, e.g. `Aug`. */
  label: string;
  /** MUSD sent in that month, in minor units. Exact — never a float. */
  units: bigint;
  /**
   * True for the month still in progress. Its bar is drawn dimmed, because a
   * part-month is always short of a whole one: without that mark the current
   * bar reads as a fall in spending that has not happened.
   */
  partial: boolean;
};

/**
 * Money out, by month.
 *
 * The transactions screen is the record; this is the shape of it. A ledger
 * answers "what did I pay for" one row at a time, and the question a list
 * cannot answer is "is this more than usual" — which needs the rows side by
 * side rather than stacked, so they get six columns and a baseline.
 *
 * ## Where the numbers come from
 *
 * `rows` is the *filtered* list — the same rows drawn underneath. It has to be:
 * a summary that disagrees with its own list is worse than no summary, which is
 * the rule the totals strip above already follows. So narrowing to one person
 * charts what was sent to that person, and a search narrows the chart with the
 * list.
 *
 * ## What is counted
 *
 * Only MUSD that left — `direction: "sent"` and `asset: "MUSD"`. A chart of
 * spending that counted incoming payments would answer a question nobody asked.
 * The asset filter is the other half of the same rule: `amountUnits` is
 * denominated in the row's own token, so a BTC row mixed in would be wei added
 * to hundredths, and being 10¹⁶ to the unit it would flatten every dollar bar to
 * nothing. A BTC transfer shows in the list under this chart and not in the
 * chart, which is why the caption below names MUSD.
 *
 * The amounts are summed as integers in the app's minor units and formatted
 * once, so the figure is exact rather than a float that happens to print
 * correctly at this size.
 *
 * ## When it draws nothing
 *
 * All six months empty means every bar would be a stub: furniture that costs a
 * screen's worth of height to say what the empty list underneath already says.
 * The component returns `null` and the screen closes the gap.
 */
export function SpendChart({ rows }: { rows: Transaction[] }) {
  const buckets = useMemo(() => {
    const now = new Date();

    /*
      The window, oldest first, built from the calendar rather than from the
      data. A month with nothing in it is a real month and gets a column; if the
      columns were derived from the rows, a quiet month would silently close up
      and the two sides of a gap would sit next to each other as though nothing
      had happened between them.
    */
    const window = Array.from({ length: MONTHS }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString(undefined, { month: "short" }),
        partial: index === 0,
        units: 0n,
      };
    }).reverse();

    const byMonth = new Map(window.map((bucket) => [bucket.key, bucket]));

    for (const tx of rows) {
      if (tx.direction !== "sent") continue;
      /*
        MUSD only, which is what the caption and the aria-label below already
        claim. A BTC row's `amountUnits` is wei and a MUSD row's is hundredths,
        so a bar built from both would be a height with no unit — and it would
        dwarf the dollars, since wei counts 10¹⁶ to the dollar. A BTC transfer
        appears in the list under this chart; it is not in the chart.
      */
      if (tx.asset !== "MUSD") continue;
      const bucket = byMonth.get(
        `${tx.createdAt.getFullYear()}-${tx.createdAt.getMonth()}`,
      );
      // Older than the window. Counted nowhere, and the caption says so.
      if (!bucket) continue;
      bucket.units += tx.amountUnits;
    }

    return window satisfies Bucket[];
  }, [rows]);

  const total = buckets.reduce((sum, bucket) => sum + bucket.units, 0n);

  /*
    Bar heights as whole percentages of the tallest month, so the tallest bar is
    the full plot and the rest are read against it. Integer division on `bigint`
    keeps the ratio exact; `Number` is used only to turn a percentage into px,
    where nothing is being counted.
  */
  const peak = buckets.reduce(
    (max, bucket) => (bucket.units > max ? bucket.units : max),
    0n,
  );

  if (peak === 0n) return null;

  const heights = buckets.map((bucket) =>
    bucket.units === 0n ? 0 : Number((bucket.units * 100n) / peak),
  );

  const summary = buckets
    .map((bucket) => `${bucket.label} ${formatMoney(bucket.units)}`)
    .join(", ");

  return (
    <section className="pk-card mb-4">
      <div className="pk-row pk-sp">
        <span style={{ fontSize: 13, opacity: 0.7 }}>Spending</span>
        <b style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(total)}
        </b>
      </div>
      <p className="pk-m" style={{ fontSize: 11, marginTop: 2 }}>
        {`Last ${MONTHS} months, sent`}
      </p>

      {/*
        The bars are one labelled image rather than a list of unlabelled
        rectangles: a screen reader gets the months and their figures in order,
        which is the content, instead of six empty boxes. The visual row is
        hidden from it at the same time, so the same numbers are not announced
        twice.
      */}
      <div
        role="img"
        aria-label={`MUSD sent over the last ${MONTHS} months. ${summary}.`}
        className="mt-3"
      >
        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "flex-end", gap: 8, height: PLOT_HEIGHT }}
        >
          {buckets.map((bucket, index) => (
            <div
              key={bucket.label}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              {bucket.units === 0n ? (
                /* A month that passed with nothing sent. Drawn at the floor of
                   the plot in the faintest surface rather than omitted, so the
                   gap is visible as a gap and not as absent data. */
                <div
                  style={{
                    height: 3,
                    borderRadius: 3,
                    background: "var(--line)",
                  }}
                />
              ) : (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heights[index]}%` }}
                  transition={{ ...stagger(index, 0.05), duration: 0.4 }}
                  style={{
                    minHeight: MIN_BAR_PX,
                    borderRadius: "8px 8px 3px 3px",
                    background: "var(--p)",
                    opacity: bucket.partial ? 0.45 : 1,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div
          aria-hidden="true"
          style={{ display: "flex", gap: 8, marginTop: 6 }}
        >
          {buckets.map((bucket) => (
            <span
              key={bucket.label}
              className="pk-m"
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                opacity: bucket.partial ? 0.55 : 1,
              }}
            >
              {bucket.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
