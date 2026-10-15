"use client";

import { usePocket } from "@/components/pocket/store";
import { cn } from "@/lib/utils";

/**
 * The honesty marker.
 *
 * The reference design labels nothing, so this is deliberately the smallest
 * thing that can do the job: a dot and a word, sitting next to the number it
 * qualifies. It is not a banner, and it never competes with the amount.
 *
 * It is the one piece of the reference that is *not* copied, on purpose. Every
 * figure in the reference reads as a funded wallet — a balance, a completed
 * payment, a borrowing limit — and Pocket had none of that until Mezo was
 * wired. So the marker rides along with anything that looks like money, and it
 * says what the number is rather than hiding it.
 *
 * It disappears when the money is real. That is the whole point of the
 * component, so the test is not "is this screen still a demo" but "is the
 * number under it real" — and only the store knows that. `/home` runs on the
 * live backend, so every balance is a real balance and "Simulated — no funds
 * moved" would be a lie printed under a real payment. `/app` runs on fixtures
 * and shows the marker everywhere.
 *
 * A handful of screens are demo-only whatever the mode — merchant, vault,
 * spending. They keep their markers by not rendering at all in the real app:
 * the personal dock offers those tabs only in demo mode. So this component
 * does not need to ask which kind of screen it is on.
 *
 * `tone` picks the ink, because the marker sits on three different surfaces:
 * the page, the purple card, and the yellow one.
 */
export function DemoBadge({
  label = "Demo",
  tone = "page",
  className,
}: {
  label?: string;
  tone?: "page" | "onPurple" | "onYellow" | "onInverse";
  className?: string;
}) {
  const { demoMode } = usePocket();
  if (!demoMode) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide",
        tone === "page" && "text-[var(--m)]",
        tone === "onPurple" && "text-white/60",
        tone === "onYellow" && "text-black/55",
        tone === "onInverse" && "text-[var(--invt)]/60",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
