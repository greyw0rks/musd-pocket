/**
 * Pocket — the brand kit.
 *
 * The product is the brand. Every value here is taken from
 * `components/pocket/pocket.css`, which is the design system the app actually
 * renders with — not from the marketing site, whose green is a different
 * surface with a different job. New screens and anything built on Pocket read
 * from this file (or from the CSS variables it documents) so the app cannot
 * fork into two looks.
 *
 * This module is deliberately pure: no imports, no environment, no CSS. That is
 * what lets `node --experimental-strip-types` test it directly, and what lets
 * `pocket.css` remain the single place the values are *applied*.
 *
 * The contract, in one line: **colours are roles, never pigments.** `--s` is a
 * surface, `--t` is text on it, `--inv` is the one inverse pair the primary
 * button uses. Light and dark are the same stylesheet with different values, so
 * a rule that hard-codes a hex is a rule that breaks in the other theme.
 */

export type Theme = "light" | "dark";

/**
 * The app's colour roles, in the order they are declared in `pocket.css`.
 *
 * `g` and `gInk` are two colours, not one: `g` is a *fill* (the checkmark disc,
 * the success circle) and carries white on top of it; `gInk` is the same idea
 * used as *text* (a settled amount, a valid-handle hint). The bright green is
 * unreadable as ink on a white page, so in the light theme the ink is a darker
 * green and in the dark theme it reverts to the fill colour.
 *
 * `line` is a hairline derived from the text colour rather than picked, so it
 * inverts with it. `lineAlpha` is the share of `t` it is mixed at.
 */
export interface Palette {
  /** App background, behind every surface. */
  bg: string;
  /** A card, sheet, or input. The default raised surface. */
  s: string;
  /** A second, quieter surface: flat icon buttons, detail cells, tags. */
  s2: string;
  /** Text on any surface. */
  t: string;
  /** Secondary text. Never below 4.5:1 on `s` — see `tokens.test.ts`. */
  m: string;
  /** The brand accent. One material, used sparingly. */
  p: string;
  /** The highlight. Carries the money cards. */
  y: string;
  /** Success *fill*. Carries white. */
  g: string;
  /** Success *ink*. Legible as text in both themes. */
  gInk: string;
  /** Danger *fill*. Carries white. Only ever means "already going wrong". */
  r: string;
  /**
   * Danger *ink* — the same split as green, for the same reason.
   *
   * Red is used as 11–12px error text far more often than as a fill, and no
   * single red can satisfy both jobs: white-on-red needs a dark red, red-on-
   * black needs a light one. So the fill stays the fill, and every error
   * message reads this token.
   */
  rInk: string;
  /** Placeholder, grab handles, gutters — never a text colour. */
  ph: string;
  /** The inverse pair: primary buttons and selected chips. */
  inv: string;
  invt: string;
  /** The dark wash detail cells sit on inside the yellow and purple cards. */
  wash: string;
  /** Share of `t` mixed into transparency for a hairline. */
  lineAlpha: number;
}

/**
 * The two themes.
 *
 * Light is the reference: it is the one the product was drawn in, and it is the
 * one the contrast tests are written against. Dark is not an inversion — it is
 * the same roles with values chosen to stay readable on black, which is why
 * `gInk` is the only role whose *relationship* changes.
 */
export const palette: Record<Theme, Palette> = {
  light: {
    bg: "#f4f4f6",
    s: "#ffffff",
    s2: "#f1f1f4",
    t: "#0b0b0d",
    m: "#6b6b75",
    p: "#a63fd9",
    y: "#ffc83d",
    g: "#16a34a",
    gInk: "#15803d",
    r: "#dc2626",
    rInk: "#b91c1c",
    ph: "#dcdce2",
    inv: "#0b0b0d",
    invt: "#ffffff",
    wash: "rgb(0 0 0 / 0.11)",
    lineAlpha: 0.08,
  },
  dark: {
    bg: "#000000",
    s: "#161618",
    s2: "#222226",
    t: "#ffffff",
    m: "#85858f",
    p: "#a63fd9",
    y: "#ffc83d",
    g: "#16a34a",
    gInk: "#16a34a",
    r: "#dc2626",
    rInk: "#f87171",
    ph: "#1c1c20",
    inv: "#ffffff",
    invt: "#000000",
    wash: "rgb(0 0 0 / 0.11)",
    lineAlpha: 0.14,
  },
};

/**
 * Type. Poppins throughout, at three weights: 500 is body, 600 is every
 * heading and amount, 700 is reserved for the wordmark.
 *
 * The scale is the classes `pocket.css` already implements. Screens should use
 * those classes rather than restating size/weight/leading, so a change here has
 * one place to land.
 */
export const type = {
  family: "Poppins",
  /** What the token actually resolves to when Poppins is unavailable. */
  stack: "Poppins, ui-sans-serif, system-ui, sans-serif",
  weights: { body: 500, emphasis: 600, mark: 700 },
  scale: [
    {
      token: "amount",
      className: "pk-amt",
      size: 52,
      weight: 600,
      lineHeight: 1.15,
      tracking: -1,
      use: "The one number a screen is about.",
    },
    {
      token: "big",
      className: "pk-big",
      size: 34,
      weight: 600,
      lineHeight: 1.2,
      tracking: -0.5,
      use: "A balance on a card.",
    },
    {
      token: "h1",
      className: "pk-h1",
      size: 28,
      weight: 600,
      lineHeight: 1.2,
      tracking: 0,
      use: "Screen title.",
    },
    {
      token: "h2",
      className: "pk-h2",
      size: 17,
      weight: 600,
      lineHeight: 1.3,
      tracking: 0,
      use: "Section heading, bar title.",
    },
    {
      token: "body",
      className: "",
      size: 15,
      weight: 500,
      lineHeight: 1.45,
      tracking: 0,
      use: "Prose and control labels.",
    },
    {
      token: "meta",
      className: "pk-m",
      size: 12,
      weight: 500,
      lineHeight: 1.4,
      tracking: 0,
      use: "Secondary detail under a row.",
    },
  ],
} as const;

/**
 * Radii. The primary button is the one rule worth stating: its radius is half
 * its height, so it is a pill at any height. Everything else is a rounded
 * rectangle whose radius says how far above the background it sits — sheets
 * rise higher than cards, the shell higher still.
 */
export const radii = {
  pill: 12,
  input: 16,
  chip: 20,
  card: 24,
  button: 27,
  sheet: 32,
  shell: 44,
  use: {
    pill: "Status tags, at 11px.",
    input: "Fields.",
    chip: "Filter chips.",
    card: "Every card and list container.",
    button: "The primary action. Half of its 54px height.",
    sheet: "A panel rising over a screen.",
    shell: "The app frame at desktop widths.",
  },
} as const;

/**
 * The spacing scale. Every gap in the app is a multiple of 4; the common ones
 * are named so a screen reads as a rhythm rather than a list of numbers.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  /** The control height the whole app is built around. */
  touch: 44,
  /** Primary button height. */
  button: 54,
} as const;

/**
 * Motion. Two durations, both short: press feedback is felt, not watched, and
 * state changes are allowed to be seen. Screen-to-screen transitions are a
 * spring owned by the motion layer, not a CSS duration.
 */
export const motion = {
  press: { duration: 200, scale: 0.95, easing: "ease-out" },
  state: { duration: 250, easing: "ease" },
  /** The spring the screen transition uses. */
  spring: { stiffness: 380, damping: 34, mass: 0.9 },
} as const;

/**
 * The partner accent. Mezo orange exists so attribution can be *shown* — a
 * "settled on Mezo" mark, the chain's own logo treatment — without pretending
 * it is part of Pocket's palette.
 *
 * It used to be the app icon's ground. That made the shortcut on someone's home
 * screen an advertisement for the chain rather than the product, so the icon
 * now draws on the brand accent (`palette.light.p`) and orange is back to being
 * nothing but attribution: never a background for Pocket content, never a
 * button colour.
 */
export const partners = {
  mezo: {
    name: "Mezo",
    accent: "#FF5A36",
    use: "Attribution only — never Pocket's own surface.",
  },
} as const;

/** The wordmark: lowercase, one dot, and nothing else. */
export const wordmark = {
  text: "pocket",
  dot: true,
  casing: "lowercase",
  rule: "One dot. No tagline lockup, no gradient.",
} as const;

/**
 * The mark's palette.
 *
 * The mark is two stacked money cards rising out of a pocket — the same pair the
 * home screen opens on. It takes its colours from the product roles (`p`, `s`,
 * `y`) but deliberately fixes them: an icon on a home screen is an object, not a
 * screen, so it does not invert with the app's theme. A dark-mode version of the
 * icon would be a second logo.
 */
export const mark = {
  /** The tile: the brand accent, the same in both themes. */
  ground: palette.light.p,
  /** The pocket and the card in front of it. */
  ink: palette.light.s,
  /** The card behind — the `y` highlight, which is where money sits. */
  highlight: palette.light.y,
} as const;

/** Everything a new screen needs, in one import. */
export const brand = {
  name: "Pocket",
  palette,
  type,
  radii,
  space,
  motion,
  partners,
  wordmark,
  mark,
} as const;
