import { cn } from "@/lib/utils";

/**
 * Quiet lowercase wordmark. The dot is the only flourish.
 *
 * It used to take a `showMusd` flag that prefixed the ticker ("mUSD pocket.").
 * The brand kit states the mark as lowercase, one dot, and nothing else — a
 * ticker in front is a second lockup, and the page already says mUSD in every
 * paragraph that needs to.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <span>pocket</span>
      <span className="text-primary">.</span>
    </span>
  );
}
