"use client";

import { cn } from "@/lib/utils";
import { useMezoNetwork } from "@/hooks/use-mezo-network";

export function NetworkBadge({ className }: { className?: string }) {
  const { wrongNetwork, networkName, switchToMezo, isSwitching } =
    useMezoNetwork();

  if (wrongNetwork) {
    return (
      <button
        onClick={switchToMezo}
        disabled={isSwitching}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-error-soft px-2.5 py-1 text-[13px] font-medium text-error hover:opacity-90 disabled:opacity-60",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-error" />
        {isSwitching ? "Switching…" : "Wrong network — switch"}
      </button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[13px] font-medium text-muted",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-success" />
      {networkName}
    </span>
  );
}
