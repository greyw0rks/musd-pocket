"use client";

import { cn } from "@/lib/utils";

/**
 * An on/off switch.
 *
 * A real `<button role="switch">` rather than a styled checkbox, because
 * these all sit inside rows and change a setting immediately — there is no
 * form to submit, so a checkbox's "will it save?" ambiguity is wrong here.
 *
 * The knob's travel is a CSS transition rather than a motion `layout`. It was
 * a layout animation before, which measured two positions and sprung between
 * them — correct, but it re-measured on every render of the row it lives in,
 * and a setting that saves as you toggle re-renders the row. The CSS version
 * is one transform on one element and cannot drift.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — these are often rendered beside a separate label. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "pk-tg outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]",
        checked && "pk-tg--on",
        disabled && "cursor-not-allowed opacity-45",
        className,
      )}
    />
  );
}
