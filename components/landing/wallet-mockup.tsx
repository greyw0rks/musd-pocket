"use client";

import { useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { TICKER } from "@/components/landing/constants";
import { cn } from "@/lib/utils";

const ACTIVITY = [
  { label: "Coffee", amount: "5.00", direction: "out" as const },
  { label: "Alex", amount: "20.00", direction: "out" as const },
  { label: "Sarah", amount: "50.00", direction: "in" as const },
];

const START_BALANCE = 250;

/**
 * The hero product mock (brief §8). It is a *mock* — no wallet, no chain, no
 * data — but it is rendered from the same tokens as the real Home screen so the
 * marketing page and the product look like one thing.
 */
export function WalletMockup({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const balance = useMotionValue(reduceMotion ? START_BALANCE : 0);
  const display = useTransform(balance, (v) => v.toFixed(2));

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(balance, START_BALANCE, {
      duration: 1.4,
      delay: 0.35,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [balance, reduceMotion]);

  return (
    <div className={cn("relative w-full max-w-[340px]", className)}>
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-mezo/10 blur-3xl"
      />

      <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold">Pocket</h2>
          <span aria-hidden className="select-none text-muted">
            ⋯
          </span>
        </div>

        <div className="mt-7">
          <p className="text-[13px] font-medium text-muted">Available</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-[40px] font-semibold leading-none tracking-tight">
              <motion.span>{display}</motion.span>
            </span>
            <span className="text-sm font-medium text-muted">
              {TICKER}
            </span>
          </p>
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] font-semibold text-foreground"
        >
          <Plus className="size-3.5" />
          Add funds
        </button>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <MockAction icon={ArrowUpRight} label="Send" />
          <MockAction icon={ArrowDownLeft} label="Request" />
        </div>

        <div className="mt-7">
          <p className="text-[13px] font-medium text-muted">Recent</p>
          <ul className="mt-3 flex flex-col gap-3">
            {ACTIVITY.map((row, i) => (
              <motion.li
                key={row.label}
                className="flex items-center justify-between text-sm"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.12, ease: "easeOut" }}
              >
                <span className="text-foreground">{row.label}</span>
                <span
                  className={cn(
                    "tabular font-medium",
                    row.direction === "in" ? "text-success" : "text-muted",
                  )}
                >
                  {row.direction === "in" ? "+" : "−"}
                  {row.amount}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MockAction({
  icon: Icon,
  label,
}: {
  icon: typeof ArrowUpRight;
  label: string;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm font-semibold text-foreground">
      <Icon className="size-4" />
      {label}
    </span>
  );
}
