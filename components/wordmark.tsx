import { cn } from "@/lib/utils";

/** Quiet lowercase wordmark. The dot is the only flourish. */
export function Wordmark({
  className,
  showMusd = false,
}: {
  className?: string;
  showMusd?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      {showMusd && <span className="text-muted">mUSD</span>}
      <span>pocket</span>
      <span className="text-primary">.</span>
    </span>
  );
}
