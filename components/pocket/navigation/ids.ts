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
 * The personal half is grouped the way the dock presents it: the three tabs
 * first (`home`, `vault`, `spending`), then the borrowing screen the home
 * card's Repay notch leads to, then everything the tabs lead *to*.
 */

export type ScreenId =
  // 1 · Onboarding
  | "welcome"
  | "auth"
  | "account-type"
  | "profile-setup"
  | "onboarding-done"
  // 2 · The three dock tabs
  | "home"
  | "vault"
  | "spending"
  // 2b · Borrowing — reached from the home card, not the dock
  | "borrow"
  // 2c · The ledger
  | "transactions"
  | "transaction"
  | "notifications"
  // 2d · Account
  | "contacts"
  | "profile"
  | "settings"
  | "account-overview"
  // 3 · Receive and requests
  | "receive"
  | "requests"
  | "request"
  | "request-detail"
  | "scan"
  // 4 · Merchant
  | "merchant-home"
  | "merchant-profile"
  | "merchant-receive"
  | "merchant-qr"
  | "merchant-request"
  | "merchant-payments"
  | "merchant-payment-detail"
  | "merchant-settings"
  // 5 · Sending
  | "transfer"
  | "success";

export interface ScreenParams {
  /** Which recipient a transfer is for. */
  recipientId?: string;
  /** Which receipt the success screen is showing. */
  transactionId?: string;
  /** Which request the detail screen is showing. */
  requestId?: string;
  /** Which vault goal the detail sheet was opened on. */
  goalId?: string;
}

export interface StackEntry {
  id: ScreenId;
  params: ScreenParams;
  /** Distinguishes two visits to the same screen for the transition key. */
  key: string;
}
