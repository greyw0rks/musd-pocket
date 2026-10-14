"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertIcon, OfflineIcon, RefreshIcon } from "@/components/pocket/icons";
import { Button } from "@/components/pocket/ui/Button";

/**
 * The states every screen owes the user.
 *
 * The build plan lists these as required across the app. They are components
 * rather than ad-hoc markup so that "what does empty look like" has one
 * answer, and a screen that forgets one is a missing import rather than a
 * missing design decision.
 *
 * Each one takes an action, because a dead end the user cannot leave is the
 * failure mode these exist to prevent.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  surface: _surface,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center px-8 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="pk-ico pk-ico--lg mb-4 text-[var(--m)]">{icon}</span>
      ) : null}

      <p className="text-[15px] font-semibold">{title}</p>

      {description ? (
        <p className="pk-m mt-1.5 max-w-[34ch] leading-relaxed">{description}</p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </motion.div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  surface,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  surface?: "dark" | "light";
  className?: string;
}) {
  return (
    <EmptyState
      icon={<AlertIcon size={24} />}
      title={title}
      description={description}
      surface={surface}
      className={className}
      action={
        onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshIcon size={14} />}
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * No network.
 *
 * Its own state rather than an error, because the advice differs: an error
 * means retry, being offline means wait. It is reached from the connectivity
 * probe in the session layer, which is real — a browser does know when it has
 * no network.
 */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<OfflineIcon size={24} />}
      title="You are offline"
      description="Pocket needs a connection to reach the network. Nothing has been lost — try again when you are back."
      action={
        onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshIcon size={14} />}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/** The spinner, re-exported so a screen imports one module for its states. */
export { Spinner } from "@/components/pocket/ui/Spinner";

/** One shimmering block. */
export function Skeleton({
  className,
  surface: _surface,
}: {
  className?: string;
  surface?: "dark" | "light";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-lg bg-[var(--s2)]", className)}
    />
  );
}

/** The shape of a list that has not arrived yet. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <span className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </span>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
