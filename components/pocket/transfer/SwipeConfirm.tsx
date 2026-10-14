"use client";

import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@/components/pocket/icons";
import { Spinner } from "@/components/pocket/ui/Spinner";
import { cn } from "@/lib/utils";

/** Handle diameter, and the air between it and the track edge. `.pk-sw-k`. */
const HANDLE = 48;
const PAD = 5;

/**
 * Swipe to confirm.
 *
 * A payment should take a deliberate gesture, so this is a drag, not a tap.
 * But a drag-only control locks out anyone using a keyboard, so the same
 * action is also a real button that takes over the track while focused. Both
 * paths call the same `onConfirm`.
 *
 * The track is `.pk-sw` from the stylesheet — the reference's own swipe
 * control, with the purple handle it draws there. The fill and the handle are
 * the two pieces motion drives; everything else (the radius, the label's
 * position, the disabled fade) is CSS, so the control reads the same wherever
 * it is dropped.
 *
 * While `busy` or `disabled` the handle refuses to move. That is the
 * duplicate-send guard at the control level — the authoritative one lives in
 * the state machine, because a control cannot be trusted to be the only guard.
 */
export function SwipeConfirm({
  onConfirm,
  confirmAriaLabel,
  disabled = false,
  busy = false,
  label = "Swipe to confirm",
  busyLabel = "Sending…",
  resetSignal = 0,
  className,
}: {
  onConfirm: () => void;
  confirmAriaLabel: string;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  /** Change this number to snap the handle back to the start. */
  resetSignal?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxX, setMaxX] = useState(196);
  const x = useMotionValue(0);

  /** The purple trail that follows the handle. */
  const fillWidth = useTransform(x, (value) => value + HANDLE);
  const labelOpacity = useTransform(x, [0, 30], [1, 0]);

  // The track is framed but the phone it is drawn in is not fixed, so the
  // travel distance is measured rather than assumed.
  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;

    const measure = () =>
      setMaxX(Math.max(0, element.offsetWidth - HANDLE - PAD * 2));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const locked = disabled || busy;

  // Snap back the moment the control stops accepting input.
  useEffect(() => {
    if (locked) animate(x, 0, { duration: 0.15 });
  }, [locked, x]);

  // Snap back on request (e.g. after a failed send leaves us on this screen).
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  }, [resetSignal, x]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (locked) return;

    if (info.offset.x >= maxX * 0.8) {
      animate(x, maxX, { type: "spring", stiffness: 400, damping: 32 });
      onConfirm();
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  }

  return (
    <div
      ref={trackRef}
      data-disabled={locked ? "true" : "false"}
      className={cn("pocket-swipe pk-sw", className)}
    >
      {/* Trail, drawn behind the handle. */}
      <motion.span
        aria-hidden="true"
        style={{ width: fillWidth }}
        className="pk-sw-fl"
      />

      {/* Instruction, hidden while the handle is moving. */}
      <motion.i
        aria-hidden="true"
        style={{ opacity: busy ? 1 : labelOpacity }}
        className="gap-2"
      >
        {busy && <Spinner className="!size-4 !border-2" />}
        {busy ? busyLabel : label}
      </motion.i>

      {/* Keyboard path. Hidden until focused, then it takes over the track. */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={locked}
        aria-label={confirmAriaLabel}
        className={cn(
          "sr-only rounded-full",
          "focus:not-sr-only focus:absolute focus:inset-0 focus:z-20",
          "focus:flex focus:items-center focus:justify-center",
          "focus:bg-[var(--inv)] focus:text-[12px] focus:font-semibold focus:text-[var(--invt)]",
        )}
      >
        {busy ? busyLabel : confirmAriaLabel}
      </button>

      {/* Pointer path. */}
      <motion.div
        drag={locked ? false : "x"}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        role="slider"
        aria-label={confirmAriaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-disabled={locked}
        className="pk-sw-k outline-none"
      >
        {/*
          The ring reads against the handle, which is the inverse fill — black
          in the light theme and white in the dark one — so it is drawn from
          the inverse *text* colour rather than hard-coded white, which would
          vanish on the white handle.
        */}
        {busy ? (
          <Spinner className="!size-5 !border-2 !border-[color-mix(in_srgb,var(--invt)_35%,transparent)] !border-t-[var(--invt)]" />
        ) : (
          <ChevronRightIcon size={20} />
        )}
      </motion.div>
    </div>
  );
}
