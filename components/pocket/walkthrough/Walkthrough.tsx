"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { ScreenId } from "@/components/pocket/navigation/ids";
import { TOUR_STEPS, type TourScreen } from "@/components/pocket/walkthrough/tour";
import {
  getTourServerSnapshot,
  getTourSnapshot,
  maybeAutoStartTour,
  nextTourStep,
  previousTourStep,
  stopTour,
  subscribeTour,
} from "@/components/pocket/walkthrough/store";

/**
 * The walkthrough overlay.
 *
 * It dims the app, cuts a hole around one real element, and puts a small card
 * beside it. The hole is not a clipped shape — it is a div with a very large
 * `box-shadow`, which is the cheapest way to darken everything that is not the
 * target without compositing a mask, and it animates between steps for free.
 *
 * **It measures, it does not assume.** Every step names a `data-tour`
 * attribute; the overlay finds that element, scrolls it into view, and reads
 * its rectangle relative to its own box. That is why the spotlight lands on the
 * balance card even though the card grows when the chain read arrives, and on
 * the dock even though the dock is a sibling of the screen rather than part of
 * it.
 *
 * **It changes screens itself.** Two steps live off Home — the receipts row on
 * Profile and the passkey card on Settings — so when the step's `screen` is not
 * the screen showing, the overlay asks the host to navigate and then waits for
 * the target to appear. A screen swap is an exit animation followed by an
 * enter one (`AnimatePresence mode="wait"`), which is why the measurement pass
 * retries for a while instead of trusting a single frame.
 *
 * **It runs itself once.** The store decides (see `tour.ts` and `store.ts`);
 * this component only calls `maybeAutoStartTour` when the screen changes. After
 * the user finishes or skips, the flag is written and it never opens on its own
 * again — but Settings can still replay it.
 *
 * The overlay is deliberately mounted inside the app's relative wrapper, not at
 * the document root. On desktop the app is a 400px column with a rounded
 * shell, and a viewport-wide dim would darken the page around it instead of the
 * app inside it.
 */

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The height of the overlay, used to place the card from the bottom. */
  shell: number;
}

export function Walkthrough({
  screenId,
  onNavigate,
  onClose,
}: {
  screenId: ScreenId;
  /** Puts the step's screen on top. Called only when the tour changes screens. */
  onNavigate: (screen: TourScreen) => void;
  /** After the tour closes — finishing on Settings should not strand you there. */
  onClose: () => void;
}) {
  const tour = useSyncExternalStore(
    subscribeTour,
    getTourSnapshot,
    getTourServerSnapshot,
  );

  const overlayRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  /*
    The first-run decision. `maybeAutoStartTour` writes to the external store,
    not to React state, so this is safe from an effect — the store notifies and
    React re-renders through `useSyncExternalStore`.
  */
  useEffect(() => {
    maybeAutoStartTour(screenId);
  }, [screenId, tour.ready]);

  const step = TOUR_STEPS[tour.step];

  /*
    Cross-screen steps. The tour navigates rather than asking the user to go
    somewhere and find the control themselves — by the time the overlay has
    dimmed the app, they cannot even press the screen underneath.

    The comparison is against `screenId`, so this is a no-op on every render
    that is already on the right screen, including the render the navigation
    itself causes.
  */
  useEffect(() => {
    if (!tour.open || !step) return;
    if (step.screen !== screenId) onNavigate(step.screen);
  }, [tour.open, tour.step, step, screenId, onNavigate]);

  /*
    Closing is two things: end the tour in the store, and let the host decide
    where the user should be standing afterwards. They are separate because the
    store is testable without a browser and the host owns the stack.
  */
  const close = useCallback(() => {
    stopTour();
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!tour.open || !step) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    let alive = true;

    /* Returns whether the target existed. A miss is not final: the element may
       be behind an exit animation or on a screen that has not mounted yet. */
    const paint = (): boolean => {
      if (!alive) return true;
      const target = overlay.ownerDocument.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      if (!target) {
        setSpot(null);
        return false;
      }

      target.scrollIntoView({ block: "center", behavior: "auto" });

      const box = target.getBoundingClientRect();
      const shell = overlay.getBoundingClientRect();
      setSpot({
        top: box.top - shell.top,
        left: box.left - shell.left,
        width: box.width,
        height: box.height,
        shell: shell.height,
      });
      return true;
    };

    /*
      Three timed passes, plus a second-gear retry for cross-screen steps.

      The first frame paints as soon as the step changes; the second catches the
      screen transition and the dock's spring, which are still moving when the
      step first renders. The third covers starting the tour from Settings,
      which resets to Home first — with `AnimatePresence mode="wait"` the old
      screen is still leaving at 360ms.

      The retry chain exists because a cross-screen step can outlast all three:
      the exit alone is 180ms and the enter animation starts after it, so a
      target on Profile or Settings is not in the DOM when the first pass runs.
      It retries every 300ms, eight times, and stops the moment it finds the
      element.
    */
    let retry: number | undefined;
    const paintWithRetries = (left: number) => {
      if (!alive) return;
      if (paint() || left <= 0) return;
      retry = window.setTimeout(() => paintWithRetries(left - 1), 300);
    };

    const frame = requestAnimationFrame(() => paintWithRetries(2));
    const settle = window.setTimeout(() => paintWithRetries(8), 360);
    const late = window.setTimeout(() => paintWithRetries(8), 700);
    const onResize = () => paint();
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.clearTimeout(late);
      if (retry !== undefined) window.clearTimeout(retry);
      window.removeEventListener("resize", onResize);
    };
  }, [tour.open, tour.step, step]);

  /* Escape leaves, arrows walk. A tour that traps someone with no keyboard exit
     is a modal they cannot close. */
  useEffect(() => {
    if (!tour.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") nextTourStep();
      else if (event.key === "ArrowLeft") previousTourStep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour.open, close]);

  /* Move focus into the card so a keyboard or screen-reader user is taken to
     the tour rather than left behind it. */
  useEffect(() => {
    if (!tour.open) return;
    overlayRef.current?.focus();
  }, [tour.open, tour.step]);

  if (!tour.open || !step) return null;

  const last = tour.step === TOUR_STEPS.length - 1;
  const cardStyle = placeCard(step.place, spot);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pocket-tour-title"
      tabIndex={-1}
      className="absolute inset-0 outline-none"
      style={{ zIndex: 70 }}
    >
      {spot ? (
        /* The dim, with the target punched out. */
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: spot.top - 6,
            left: spot.left - 6,
            width: spot.width + 12,
            height: spot.height + 12,
            borderRadius: 22,
            boxShadow: "0 0 0 9999px rgb(6 6 8 / 0.62)",
            transition:
              "top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "rgb(6 6 8 / 0.62)" }}
        />
      )}

      <div
        className="pk-card"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          padding: "16px 18px",
          boxShadow: "0 22px 60px rgb(0 0 0 / 0.42)",
          ...cardStyle,
        }}
      >
        <div className="pk-row pk-sp">
          <span className="pk-m font-semibold">
            {tour.step + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="pk-m font-semibold outline-none"
          >
            Skip
          </button>
        </div>

        {/* Dots: where this step sits without asking anyone to count. */}
        <div className="pk-row" style={{ gap: 5, marginTop: 8 }} aria-hidden>
          {TOUR_STEPS.map((item, index) => (
            <span
              key={item.target}
              style={{
                width: index === tour.step ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  index === tour.step ? "var(--p)" : "var(--ph)",
                transition: "width 180ms ease, background 180ms ease",
              }}
            />
          ))}
        </div>

        <h2
          id="pocket-tour-title"
          className="pk-h2"
          style={{ marginTop: 10 }}
        >
          {step.title}
        </h2>
        <p className="pk-m" style={{ marginTop: 4, lineHeight: 1.6 }}>
          {step.body}
        </p>

        <div className="pk-row" style={{ gap: 8, marginTop: 16 }}>
          {tour.step > 0 ? (
            <button
              type="button"
              className="pk-btn pk-btn--alt"
              style={{ flex: 1 }}
              onClick={previousTourStep}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="pk-btn"
            style={{ flex: 2 }}
            onClick={last ? close : nextTourStep}
          >
            {last ? "Start using Pocket" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Where the card goes, in the overlay's coordinate space.
 *
 * A step states a preference (`above`/`below`) because some targets — the dock,
 * the last few payments — have nothing under them to sit a card on. The
 * preference wins when it fits; otherwise the card takes the other side; if
 * neither side fits (a short window), it is pinned to the bottom edge and the
 * spotlight does the explaining.
 */
function placeCard(
  place: "above" | "below",
  spot: Spot | null,
): CSSProperties {
  if (!spot) return { top: "50%", transform: "translateY(-50%)" };

  const CARD_HEIGHT = 200;
  const GAP = 16;

  if (place === "below") {
    const top = spot.top + spot.height + GAP;
    if (top + CARD_HEIGHT <= spot.shell) return { top };
    return { bottom: 16 };
  }

  const bottom = spot.shell - spot.top + GAP;
  if (bottom + CARD_HEIGHT <= spot.shell) return { bottom };
  return { top: 16 };
}
