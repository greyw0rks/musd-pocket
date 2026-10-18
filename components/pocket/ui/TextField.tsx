"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon } from "@/components/pocket/icons";
import { Spinner } from "@/components/pocket/ui/Spinner";

/**
 * A labelled text input.
 *
 * Four things this carries that a bare `<input>` does not, and each exists
 * because a screen in this app needs it:
 *
 *  - a persistent label, not a placeholder — the username field's label has
 *    to stay visible while "Available" is being shown underneath it;
 *  - a `prefix` for the leading "@" that identifies a Pocket username and
 *    must not be typed or deleted;
 *  - a `status` that colours the border and shows a spinner, a tick or a
 *    cross — the availability check has three states, not two;
 *  - `hint`/`error` text that reserves its line, so a message appearing does
 *    not shove the rest of the form down.
 *
 * The field is a filled surface rather than an outlined one, which is what the
 * reference does throughout. The border is still there but transparent, so a
 * focus or an error *recolours* it instead of adding a pixel — nothing on the
 * screen moves when a check comes back.
 */
export type FieldStatus = "idle" | "checking" | "valid" | "invalid";

export function TextField({
  label,
  hint,
  error,
  prefix,
  status = "idle",
  surface: _surface,
  className,
  ...props
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  status?: FieldStatus;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
} & ComponentProps<"input">) {
  const id = useId();
  const messageId = `${id}-message`;

  const invalid = status === "invalid" || Boolean(error);
  const message = error ?? hint;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="pk-m block font-semibold uppercase"
      >
        {label}
      </label>

      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border-[1.5px] bg-[var(--s)] px-4 transition",
          invalid
            ? "border-[var(--r)]"
            : status === "valid"
              ? "border-[var(--g)]"
              : "border-transparent focus-within:border-[var(--p)]",
        )}
      >
        {prefix ? (
          <span className="text-[15px] font-semibold text-[var(--m)]">
            {prefix}
          </span>
        ) : null}

        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] font-medium text-[var(--t)] outline-none placeholder:text-[var(--m)]"
          {...props}
        />

        <span className="flex size-4 shrink-0 items-center justify-center">
          {status === "checking" ? <Spinner className="!size-4 !border-2" /> : null}
          {status === "valid" ? (
            <CheckIcon size={16} className="text-[var(--g-ink)]" />
          ) : null}
          {invalid ? <AlertIcon size={16} className="text-[var(--r-ink)]" /> : null}
        </span>
      </div>

      {/*
        The line is always rendered. A message appearing on an availability
        check would otherwise move every field below it mid-typing, which reads
        as the form flinching.
      */}
      <p
        id={messageId}
        className={cn(
          "min-h-4 px-1 text-[11px] leading-4",
          error
            ? "text-[var(--r-ink)]"
            : status === "valid"
              ? "text-[var(--g-ink)]"
              : "text-[var(--m)]",
        )}
      >
        {message}
      </p>
    </div>
  );
}

/**
 * A multi-line variant, because merchant descriptions and payment notes are
 * several lines and a single-line input cannot show them.
 */
export function TextArea({
  label,
  hint,
  error,
  surface: _surface,
  className,
  ...props
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Ignored — the theme decides. Kept only for un-migrated call sites. */
  surface?: "dark" | "light";
} & ComponentProps<"textarea">) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="pk-m block font-semibold uppercase">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ?? hint ? messageId : undefined}
        className={cn(
          "w-full resize-none rounded-2xl border-[1.5px] bg-[var(--s)] px-4 py-3.5 text-[15px] font-medium",
          "text-[var(--t)] outline-none placeholder:text-[var(--m)] transition",
          error
            ? "border-[var(--r)]"
            : "border-transparent focus:border-[var(--p)]",
        )}
        {...props}
      />
      <p
        id={messageId}
        className={cn(
          "min-h-4 px-1 text-[11px] leading-4",
          error ? "text-[var(--r-ink)]" : "text-[var(--m)]",
        )}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
