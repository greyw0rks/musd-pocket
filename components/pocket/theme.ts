/**
 * The design language, in one place.
 *
 * Two halves. The motion half is a set of named springs and variants so a
 * screen never declares its own; the surface half is now a short list of
 * hand-written class names from `pocket.css` rather than Tailwind strings.
 *
 * That second half is the change worth recording. The previous pass expressed
 * every surface as a Tailwind class list at the point of use, which worked
 * while there was exactly one recipe. There are now several — a plain card, a
 * tinted card, a group of rows, a keypad — and each one has to resolve its
 * colours from the token block so both themes come out right. A Tailwind string
 * cannot do that; `bg-[var(--s)]` can, but the moment the recipe grows a second
 * property it becomes an unreadable arbitrary value repeated eighty times. So
 * the recipes live in CSS and these constants are their names.
 */

import type { Transition, Variants } from "motion/react";

/* -------------------------------------------------------------------------- */
/* Motion                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The house spring: fast enough to feel immediate, slack enough to settle
 * rather than stop. Lower damping than a critically-damped value is deliberate
 * — the small overshoot at the end of a page transition is the whole
 * difference between a panel appearing and a panel *arriving*.
 */
const LIQUID = { type: "spring", stiffness: 300, damping: 27, mass: 0.7 } as const;

/** A heavier version, for things with more surface area — sheets, the dock. */
const LIQUID_HEAVY = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
} as const;

/**
 * A screen arriving in the stack.
 *
 * The lift is small and the fade is the load-bearing part. With opaque surfaces
 * a large slide would read as the old screen being *replaced*; the product is
 * one continuous thing, so a screen should feel like it settles into place on
 * top of the previous one rather than shunting it sideways.
 */
export const PAGE_MOTION: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: LIQUID },
  exit: { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.18 } },
};

/** A modal moment rather than a place — the send screen. */
export const MODAL_MOTION: Variants = {
  initial: { opacity: 0, y: 26, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: LIQUID },
  exit: { opacity: 0, y: 20, scale: 0.98, transition: { duration: 0.18 } },
};

/** A terminal screen — the receipt. Settles rather than departs. */
export const RESULT_MOTION: Variants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 18, stiffness: 260 },
  },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

/** A panel rising from the bottom edge. */
export const SHEET_MOTION: Variants = {
  initial: { y: 60, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: LIQUID_HEAVY },
  exit: { y: 60, opacity: 0, transition: { duration: 0.2 } },
};

/** The floating dock settling in. */
export const DOCK_MOTION: Variants = {
  initial: { y: 24, opacity: 0, scale: 0.94 },
  animate: { y: 0, opacity: 1, scale: 1, transition: LIQUID },
  exit: { y: 24, opacity: 0, transition: { duration: 0.16 } },
};

/**
 * The spring a shared-layout element travels on.
 *
 * Tighter and faster than the page spring, with a little more overshoot: this
 * is used by things that move *between* two positions the user can see at once
 * — a sliding filter, the balance cards swapping — where a slow settle reads as
 * lag rather than as weight.
 */
export const LAYOUT_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.7,
} as const;

/** The press feedback used by every tappable surface. */
export const TAP = { scale: 0.96 } as const;
export const TAP_ICON = { scale: 0.85 } as const;
export const HOVER = { scale: 1.03 } as const;

/**
 * The idle wobble, for a control that wants to be pressed.
 *
 * An infinite transition is a promise that something is happening, so this is
 * reserved for the one live control on a screen and never for decoration.
 */
export const BREATHE = {
  scale: [1, 1.035, 1],
  transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
} as const;

/** Rows and tiles arriving in sequence. Index drives the delay, not state. */
export function stagger(index: number, step = 0.05, max = 8): Transition {
  return { delay: Math.min(index, max) * step };
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A screen's column.
 *
 * `.pk-scr` is absolutely positioned inside the motion layer and carries the
 * 16/20 page gutter plus the dock clearance. Nothing else sets horizontal
 * padding, which is what keeps every screen aligned to the same edge.
 */
export const SCREEN = "pk-scr";

/** A screen whose content is one centered block — a result, a confirmation. */
export const SCREEN_PLAIN = "pk-scr pk-scr--plain";

/** The inset surface. Everything that sits "on" a screen is one of these. */
export const CARD = "pk-card";

/** A card being used as a list container: rows own their own padding. */
export const GROUP = "pk-group";

/** A row inside a card. */
export const ROW = "pk-li";

/** A row that is data rather than a control. */
export const ROW_STATIC = "pk-li pk-li--static";

/** The 40px disc an icon sits in, at the head of a row. */
export const ICO = "pk-ico";

/** Secondary text: a caption, a timestamp, a balance under a name. */
export const MUTED = "pk-m";

/**
 * The entrance stagger.
 *
 * A plain class rather than a motion variant, because it needs no state — the
 * CSS keyframe runs on mount and the `nth-child` delays are in the stylesheet.
 * `AnimatePresence` owns the transition between screens; this owns the arrival
 * of a screen's own children, and keeping them in different mechanisms is why
 * neither has to know about the other.
 */
export const UP = "pk-up";

/* --------------------------------------------------------------- migration */

/**
 * Names the older screens still import.
 *
 * The re-skin is happening a screen at a time, and these keep the ones that
 * have not been rewritten yet compiling and laid out correctly. They are
 * deliberately *layout only* — no colour — because colour is the part that
 * changed, and a colour alias would have silently painted half the app with
 * the wrong theme's ink instead of failing loudly.
 *
 * Delete this block when the last screen has been rewritten; nothing here is
 * referenced by anything written after it.
 */

/** Screens paint their own background now; the shell owns the page colour. */
export const SCREEN_BG = {
  home: "",
  list: "",
  panel: "",
  sheet: "",
  accent: "bg-[var(--p)] text-white",
} as const;

/** The page gutter, for a screen that is not a `.pk-scr`. */
export const GUTTER = "px-5";

export const SAFE_TOP = "pt-[max(env(safe-area-inset-top),1rem)]";

export const DOCK_CLEARANCE = "pb-28";

export const GLASS = "pk-card";
export const GLASS_STRONG = "pk-card";
export const PANEL = "pk-card";
export const GLASS_FIELD = "pk-in";
export const GLASS_PILL = "";
export const GLASS_CONTROL = "";
export const SHEET = "pk-sheet";
export const SHEET_HANDLE = "pk-sheet-handle";
