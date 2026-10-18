"use client";

import { useSyncExternalStore } from "react";
import {
  TOUR_IDLE,
  TOUR_STEPS,
  beginTour,
  endTour,
  moveTour,
  shouldAutoStart,
  type TourState,
} from "@/components/pocket/walkthrough/tour";

/**
 * Walkthrough state, held outside React.
 *
 * Same shape as `components/install/use-install.ts`, and for the same reason:
 * the first-run decision is read from storage, and reading it inside a render
 * is not allowed while reading it in an effect and calling `setState` is what
 * the `react-hooks/set-state-in-effect` rule forbids. An external store with
 * `useSyncExternalStore` has neither problem — the hydration happens once, on
 * the client, in `getSnapshot`, and every component reads the same object.
 *
 * The snapshot is cached and only replaced when something changes. That is not
 * an optimisation: `useSyncExternalStore` requires a referentially stable
 * value while nothing has changed, or every notification re-renders forever.
 */

const SEEN_KEY = "pocket:walkthrough:v1";

const listeners = new Set<() => void>();
let state: TourState = TOUR_IDLE;
let hydrated = false;

function persist(next: TourState) {
  if (!next.seen) return;
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage can be denied; the tour simply offers itself again next time */
  }
}

function emit(next: TourState) {
  state = next;
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    /* private modes and blocked storage: treat it as not seen */
  }

  state = { ...state, ready: true, seen };
}

export function getTourSnapshot(): TourState {
  ensureHydrated();
  return state;
}

/** Server render: never open, never decided. */
export function getTourServerSnapshot(): TourState {
  return TOUR_IDLE;
}

export function subscribeTour(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the tour at the first step. Used by the auto-start and by Settings. */
export function startTour() {
  emit(beginTour(getTourSnapshot()));
}

export function nextTourStep() {
  const next = moveTour(getTourSnapshot(), TOUR_STEPS.length, 1);
  persist(next);
  emit(next);
}

export function previousTourStep() {
  emit(moveTour(getTourSnapshot(), TOUR_STEPS.length, -1));
}

/** Skip, Escape, or the last step's button. */
export function stopTour() {
  const next = endTour(getTourSnapshot());
  persist(next);
  emit(next);
}

/**
 * Called by the overlay on every screen change.
 *
 * It mutates the store rather than React state, so it is safe from an effect:
 * the subscribers (including the overlay's own `useSyncExternalStore`) are
 * notified and re-render through React's normal external-store path.
 */
export function maybeAutoStartTour(screenId: string) {
  if (shouldAutoStart(getTourSnapshot(), screenId)) startTour();
}
