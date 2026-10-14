"use client";

import { cn } from "@/lib/utils";

/**
 * The spinner.
 *
 * A ring with one coloured quarter, rotating. Its own module rather than a
 * member of `States` because `Button` needs it and `States` needs `Button` —
 * both importing the spinner from a third place is what keeps that from being
 * a cycle.
 *
 * The rotation is a CSS keyframe, and it is deliberately *not* disabled by the
 * reduced-motion block in the stylesheet: a spinner that does not spin is a
 * static ring, which reads as a broken control rather than as a calm one.
 * Sensing progress is the one case where the animation is the information.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("pk-spin", className)}
    />
  );
}
