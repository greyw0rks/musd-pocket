"use client";

import { barFractions } from "@/features/payments/spending";

/**
 * A month of spending, one bar a day.
 *
 * Straight out of the reference: a 300×130 viewBox, thin rounded bars sitting
 * on a baseline at y=125, and one bar in the brand purple to carry the
 * emphasis. The geometry is the reference's, including the growth animation —
 * each bar scaling up from the baseline on a 20ms stagger, so the month
 * arrives as a sweep rather than as a block.
 *
 * What is not the reference's is which bar is lit. The reference hard-codes
 * `i == 21`. This lights the peak day of the real month, so the emphasis lands
 * on something true and moves when the data does — and on an empty month no
 * bar is lit at all, because there is no peak to point at.
 *
 * The values arrive as fractions rather than amounts: the chart has no
 * business knowing what a minor unit is, and taking 0..1 means it cannot
 * divide by a maximum that might be zero.
 */
export function SpendingChart({
  dailyUnits,
  peakDay,
  label,
}: {
  /** One entry per day of the month, in minor units. */
  dailyUnits: readonly bigint[];
  /** The day to light, or -1 for none. */
  peakDay: number;
  /** What a screen reader should hear instead of the bars. */
  label: string;
}) {
  const fractions = barFractions(dailyUnits);

  const count = fractions.length;
  // Bars are drawn in a 300-wide box, so the stride is whatever divides it.
  const step = 300 / count;
  const barWidth = Math.max(step * 0.6, 1.5);
  const inset = (step - barWidth) / 2;

  const empty = peakDay < 0;

  return (
    <svg
      viewBox="0 0 300 130"
      width="100%"
      role="img"
      aria-label={label}
      className="block"
    >
      {fractions.map((fraction, day) => {
        /*
          A zero day still gets a stub. A chart of an empty month drawn at
          true height is a blank rectangle, which reads as a broken chart
          rather than as a month without spending.
        */
        const height = empty ? 5 : Math.max(fraction * 108, 5);
        const lit = day === peakDay;

        return (
          <rect
            key={day}
            x={day * step + inset}
            y={125 - height}
            width={barWidth}
            height={height}
            rx={barWidth / 2}
            fill={lit ? "var(--p)" : "var(--s2)"}
            className={empty ? undefined : "pk-bar-grow"}
            style={empty ? undefined : { animationDelay: `${day * 0.02}s` }}
          />
        );
      })}
    </svg>
  );
}
