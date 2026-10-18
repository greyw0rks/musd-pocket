import { cn } from "@/lib/utils";

/**
 * Quiet lowercase wordmark. The dot is the only flourish.
 *
 * It used to take a `showMusd` flag that prefixed the ticker ("mUSD pocket.").
 * The brand kit states the mark as lowercase, one dot, and nothing else — a
 * ticker in front is a second lockup, and the page already says mUSD in every
 * paragraph that needs to.
 *
 * `tone` picks which palette the mark inks itself from. The marketing pages own
 * `--foreground`/`--primary` on the document; the app owns its own `--t`/`--p`
 * on `.pocket-root` and can be in the opposite theme, so inside the app the mark
 * must read those tokens instead or it would go dark-on-black.
 */
export function Wordmark({
  className,
  tone = "site",
}: {
  className?: string;
  tone?: "site" | "app";
}) {
  const app = tone === "app";
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-tight",
        app ? "text-[var(--t)]" : "text-foreground",
        className,
      )}
    >
      <span>pocket</span>
      <span className={app ? "text-[var(--p)]" : "text-primary"}>.</span>
    </span>
  );
}
