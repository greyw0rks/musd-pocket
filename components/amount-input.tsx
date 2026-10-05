"use client";

import { cn } from "@/lib/utils";
import { MUSD_SYMBOL } from "@/lib/mezo/config";

/** Large centered amount entry — the hero of the create-request screen. */
export function AmountInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const handle = (raw: string) => {
    // Allow only digits + a single decimal point, max 18 decimals.
    if (raw === "") return onChange("");
    if (!/^\d*(\.\d{0,18})?$/.test(raw)) return;
    onChange(raw);
  };

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface py-10">
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => handle(e.target.value)}
        placeholder="0.00"
        aria-label="Amount"
        className={cn(
          "tabular w-full bg-transparent text-center text-5xl font-semibold text-foreground outline-none",
          "placeholder:text-border",
        )}
      />
      <span className="mt-2 text-sm font-medium text-muted">{MUSD_SYMBOL}</span>
    </div>
  );
}
