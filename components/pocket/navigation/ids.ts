export type ScreenId =
  // 1 · Onboarding
  | "welcome"
  | "auth"
  | "account-type"
  | "profile-setup"
  | "onboarding-done"
  // 2 · Home, and the record of what happened from it
  | "home"
  | "swap"
  | "transactions"
  | "transaction"
  | "notifications"
  // 2b · The Savings Vault — a place, like Home
  | "wealth"
  | "locks"
  | "pools"
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
