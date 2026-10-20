/**
 * The walkthrough: what it points at, and how it moves.
 *
 * Two things live here and both are pure — the step list and the state machine
 * that walks it. Neither touches the DOM or storage, which is what lets the
 * awkward parts (the end of the list, the first step, the "seen" flag) be
 * tested without a browser.
 *
 * **Targets are names, not selectors.** Each step names a `data-tour` attribute
 * that a real screen carries. The overlay resolves the name at paint time, so
 * the tour measures whatever the screen actually laid out — including the parts
 * that move when the balance loads or a notification arrives — instead of
 * capturing positions that go stale the moment the app draws.
 *
 * **The steps sweep Home, then leave it once.** Account corner, the faucet,
 * then the money, the verbs, the record and the dock — then two screens the
 * first pass never showed: the receipts address on Profile and the passkey on
 * Settings. The overlay navigates to those itself, so the tour can point at a
 * control that does not live on Home without asking the user to find it first.
 * Once the sweep leaves Home it does not come back: a tour that bounces
 * between screens reads as an accident, not a route.
 *
 * Each step is a thing the user will need in the first minute, and none of them
 * is a feature the app cannot do — a tour that points at a door with nothing
 * behind it is worse than no tour.
 */

export type TourTarget =
  | "account"
  | "faucet"
  | "balance"
  | "actions"
  | "activity"
  | "nav"
  | "receipts"
  | "passkey";

/** The screens this tour visits, in the order it visits them. */
export type TourScreen = "home" | "profile" | "settings";

export interface TourStep {
  /**
   * Where the target lives. The overlay navigates when this is not the screen
   * already showing, so a step never has to be skipped just because its
   * control is behind the account corner.
   */
  screen: TourScreen;
  /** The `data-tour` attribute this step spotlights. */
  target: TourTarget;
  title: string;
  body: string;
  /**
   * Which side of the target the card prefers. It is a preference, not a rule:
   * the overlay flips it when the preferred side has no room.
   */
  place: "above" | "below";
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    screen: "home",
    target: "account",
    title: "This corner is you",
    body: "Your photo opens your profile, your wallet and settings. Everything about your account lives behind it.",
    place: "below",
  },
  {
    screen: "home",
    target: "faucet",
    title: "Claim your test money",
    body: "The faucet sends 0.015 BTC and 300 mUSD to this wallet, once — enough to open a Trove and try the vault. After the claim, this spot becomes Rewards.",
    place: "below",
  },
  {
    screen: "home",
    target: "balance",
    title: "This is your money",
    body: "Your mUSD, in the wallet only you control. Tap the card to flip it and see how much is yours and how much is borrowed against Bitcoin.",
    place: "below",
  },
  {
    screen: "home",
    target: "actions",
    title: "Four things you can do",
    body: "Send to a name or an address, request money, show your QR to receive, or borrow against Bitcoin — all from here.",
    place: "below",
  },
  {
    screen: "home",
    target: "activity",
    title: "Every payment leaves a receipt",
    body: "Tap any row to see the amount, who it was with, and the transfer on chain. View All opens your full history.",
    place: "above",
  },
  {
    screen: "home",
    target: "nav",
    title: "Three places",
    body: "Home is here. Vault puts mUSD into Mezo's savings vault. Spending is where every payment and request is kept.",
    place: "above",
  },
  {
    screen: "profile",
    target: "receipts",
    title: "Receipts can be emailed",
    body: "Add an address on your profile and a copy of every confirmed payment goes to it. It is optional, and Pocket uses it for nothing else.",
    place: "below",
  },
  {
    screen: "settings",
    target: "passkey",
    title: "Lock the money with a passkey",
    body: "Add a passkey and every signature asks for your face or fingerprint first. Pocket draws no confirmation sheet of its own, so this is what stands in its place.",
    place: "above",
  },
];

export interface TourState {
  /** The stored "seen" flag has been read. Until then the tour cannot decide. */
  ready: boolean;
  open: boolean;
  step: number;
  /** Completed or skipped once. Never auto-started again; still replayable. */
  seen: boolean;
}

export const TOUR_IDLE: TourState = {
  ready: false,
  open: false,
  step: 0,
  seen: false,
};

export function beginTour(state: TourState): TourState {
  return { ...state, open: true, step: 0 };
}

/**
 * One step forward or back.
 *
 * Forward past the end *closes* and marks the tour seen — finishing and
 * skipping are the same event as far as a second auto-start is concerned, and
 * treating them differently is how a tour becomes a nag. Back at the first
 * step is a no-op rather than a close: the back button is drawn disabled there.
 */
export function moveTour(
  state: TourState,
  total: number,
  direction: 1 | -1,
): TourState {
  if (!state.open) return state;

  const step = state.step + direction;
  if (step >= total) return { ...state, open: false, step: total - 1, seen: true };
  if (step < 0) return state;
  return { ...state, step };
}

/** Ends the tour wherever it is, marking it seen. */
export function endTour(state: TourState): TourState {
  return { ...state, open: false, seen: true };
}

/**
 * Whether arriving at this screen should open the tour on its own.
 *
 * Only Home, only once, and only after the stored flag has been read — opening
 * on a guess and then finding out the user has seen it would make the overlay
 * flash on every boot.
 */
export function shouldAutoStart(state: TourState, screenId: string): boolean {
  return state.ready && !state.seen && !state.open && screenId === "home";
}
