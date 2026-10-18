"use client";

import { useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
  QrCode,
} from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

const ACTIVITY = [
  { label: "Coffee", amount: "5.00", direction: "out" as const },
  { label: "Alex", amount: "20.00", direction: "out" as const },
  { label: "Sarah", amount: "50.00", direction: "in" as const },
];

const START_BALANCE = 250;

const ACTIONS = [
  { icon: ArrowUpRight, label: "Send" },
  { icon: ArrowDownLeft, label: "Request" },
  { icon: QrCode, label: "Receive" },
  { icon: Bitcoin, label: "Borrow" },
];

/**
 * The hero product mock (brief §8). It is a *mock* — no wallet, no chain, no
 * data — but it is drawn from the app's own balance cards
 * (`components/pocket/home/BalanceCards.tsx`): the yellow total behind, the
 * purple available balance in front, `yours + borrowed` set inline, and the
 * repayment row welded to the card's foot. The marketing page and the product
 * should look like one thing, so the mock mirrors the product's arrangement
 * rather than inventing a friendlier one.
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
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-brand/15 blur-3xl"
      />

      {/* The stacked cards, at the app's own geometry: back at 150px tall,
          front starting 44px down so the yellow sliver shows above it. */}
      <div className="relative h-[262px]">
        <div className="absolute inset-x-0 top-0 h-[150px] rounded-[26px] bg-warning px-5 py-[13px] text-[#111]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] opacity-70">Total balance</span>
            <b className="text-[15px]">$250.00</b>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[44px] h-[218px] overflow-hidden rounded-[26px] bg-brand px-5 py-[18px] text-white shadow-[0_-10px_30px_#0004]">
          <p className="text-[13px] opacity-80">Available balance</p>

          <p className="mt-1 whitespace-nowrap text-[30px] font-semibold leading-none tracking-[-1px] tabular">
            $<motion.span>{display}</motion.span>
            <span className="opacity-70"> + </span>$0.00
          </p>
          <p className="mt-1 text-[11px] opacity-70">yours + borrowed</p>

          <div className="absolute bottom-[18px] left-5">
            <p className="text-[12px] opacity-80">Repayment balance</p>
            <p className="text-[20px] font-semibold tabular">$0.00</p>
          </div>

          <span className="absolute bottom-4 right-4 inline-flex h-[50px] items-center rounded-full bg-[#0b0b0d] px-[26px] text-sm font-semibold text-white shadow-[inset_0_0_0_1px_#2a2a2e]">
            Repay
          </span>
        </div>
      </div>

      {/* The four actions, in the same white card the app uses. */}
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-[22px] bg-surface px-2 py-[18px] text-center">
        {ACTIONS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="grid justify-items-center gap-1.5 text-[12px] font-medium text-foreground"
          >
            <span className="grid size-[54px] place-items-center rounded-full bg-surface-2">
              <Icon className="size-5" />
            </span>
            {label}
          </span>
        ))}
      </div>

      {/* A strip of activity, so the card reads as a running app. */}
      <div className="mt-3 rounded-[22px] bg-surface p-4">
        <ul className="flex flex-col gap-3">
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
  );
}
