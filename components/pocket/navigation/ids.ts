/**
 * Every screen the app can show, named once.
 *
 * A union rather than free strings so a navigation to a screen that does not
 * exist is a type error rather than a blank panel. Adding a screen means
 * extending this union and adding a case to the switch in `PocketApp` — those
 * are the only two places that have to know a screen exists.
 *
 * Deliberately in its own module with no imports, so the navigation helpers,
 * the store and the host can all refer to it without a cycle.
 *
 * Three of these are *places* — `home`, `vault` and `transactions` — and they
 * are the three the dock switches between. Everything else is a step in
 * something the user is doing — sending, asking, being paid, borrowing against
 * their Bitcoin — so it is pushed with a way back rather than switched to.
 *
 * The dock was absent for a while, correctly: the build that had one carried
 * three tops behind it, and two of those were fixtures over features that did
 * not exist. Borrow, the Savings Vault and the ledger are all real now, so the
 * dock has something to switch between and it is back. `navigation/screens.ts`
 * holds which screens own it.
 */

export type ScreenId =
  // 1 · Onboarding
  | "welcome"
  | "auth"
  | "account-type"
  | "profile-setup"
  | "onboarding-done"
  // 2 · Home, and the record of what happened from it
  | "home"
  | "transactions"
  | "transaction"
  | "notifications"
  // 2b · The Savings Vault — a place, like Home
  | "vault"
  // 3 · Account
  | "contacts"
  | "profile"
  | "settings"
  | "account-overview"
  /*
    Not an account screen, but reached from one: Settings is where a user goes
    looking for a way to get money out of the wallet, and a native BTC transfer
    has nowhere else to live — it belongs to no payment row, so it can never be
    reached from the ledger.
  */
  | "withdraw-btc"
  // 4 · Receive and requests
  | "receive"
  | "requests"
  | "request"
  | "request-detail"
  | "scan"
  // 5 · Sending
  | "transfer"
  | "success"
  // 6 · Borrow
  | "borrow"
  | "borrow-open"
  | "borrow-repay";

export interface ScreenParams {
  /** Which recipient a transfer is for. */
  recipientId?: string;
  /** Which receipt the success screen is showing. */
  transactionId?: string;
  /** Which request the detail screen is showing. */
  requestId?: string;
}

export interface StackEntry {
  id: ScreenId;
  params: ScreenParams;
  /** Distinguishes two visits to the same screen for the transition key. */
  key: string;
}
