/**
 * Payment domain types.
 *
 * These describe the *shape* of a payment, independent of who performs it. One
 * adapter fills them today — `chain-payment.adapter.ts`, from a transfer the
 * user's own wallet signed and the chain confirmed. Nothing in here knows where
 * a row came from; that distinction lives on `PaymentKind` below.
 */

/**
 * How a payment was actually performed.
 *
 * There is one member because there is one way money moves here: the user's
 * wallet signs an on-chain transfer. The union survives as the place a second
 * route would be declared — it existed to separate simulated rows from real
 * ones, and the simulated rows are gone, so `"demo"` is not a value anything
 * can produce and is not a value any row may carry.
 */
export type PaymentKind = "onchain";

export type PaymentStatus = "pending" | "confirmed" | "failed";

/** Which way the money moved, from the signed-in user's point of view. */
export type PaymentDirection = "sent" | "received";

/**
 * A selectable payment destination.
 *
 * `handle` is the human-facing identity ("@sarah"). `address` is the thing
 * that actually receives money, and is only present once a handle has been
 * resolved to a verified destination. Per the build plan, a display name
 * alone must never identify a payment destination.
 */
export interface Recipient {
  id: string;
  name: string;
  handle: string;
  /** Verified destination. Absent means "handle not yet resolved". */
  address?: string;
  avatarUrl?: string;
  /** True when this identity has been resolved and verified. */
  verified: boolean;
}

/**
 * A completed or in-flight transfer.
 *
 * `amountUnits` is an integer count of *the row's own asset's* minor units —
 * money is never held as a float. Which unit that is depends on `asset`:
 * hundredths of MUSD (`amount.ts`, `DISPLAY_DECIMALS = 2`) or wei of BTC
 * (18 decimals, rendered to eight places by `borrow-format.ts`). They are
 * different unit systems, so a row must be formatted through the one its asset
 * names — handing a BTC value to `formatMoney` prints a nonsense figure, and
 * the `asset` field is what makes that impossible to do by accident.
 *
 * Rows are never summed across assets for the same reason. A total that added
 * a BTC row to a MUSD one would be a number with no meaning, so the screens
 * that total anything filter to one asset and say which.
 *
 * `amountDisplay` is a pre-formatted string for rendering only, and it carries
 * its own token's symbol — `$` or `BTC`. It is not a bare number: a figure in a
 * list that holds two tokens has to say which one it is, and a caller that
 * prefixes its own symbol would double it.
 */
export interface Transaction {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientHandle: string;
  /** Which token moved. Required, so a row that does not say cannot be built. */
  asset: PaymentAsset;
  amountUnits: bigint;
  amountDisplay: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  kind: PaymentKind;
  createdAt: Date;
  /** Present when the transfer could not be completed. */
  error?: string;
  /** On-chain reference — only ever set for `kind: "onchain"`. */
  txHash?: string;
}

/**
 * Which token a row moved.
 *
 * Only two, and they are not interchangeable. MUSD is the app's money: it is
 * what the send flow, the requests and the ledger are denominated in. BTC is
 * the chain's own gas token, moved by the user's wallet rather than by Pocket —
 * see `lib/mezo/btc-actions.ts` — so a BTC row is in the history without ever
 * having passed through the rails that produce the others.
 */
export type PaymentAsset = "MUSD" | "BTC";

export interface SendRequest {
  recipient: Recipient;
  amountUnits: bigint;
  /**
   * Reuse-across-retries key for the server's replay guard.
   *
   * Optional because the interface predates it and a service is free to ignore
   * it; a service that *can* honour it must. The caller owns the lifecycle:
   * reuse it while the outcome is unknown (a timeout, a dropped connection),
   * rotate it once the server has given a definite answer, so a genuine second
   * payment is not silently swallowed as a replay of the first.
   */
  idempotencyKey?: string;
}

export type SendResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string };

/**
 * The adapter boundary.
 *
 * The UI talks to this interface and never to a chain, a wallet, or a
 * database directly. The implementation behind it is the one place that
 * decides where money moves.
 */
export interface PaymentService {
  /** Current spendable balance, in minor units. */
  getBalance(): Promise<bigint>;

  /** Transactions, newest first. */
  listTransactions(): Promise<Transaction[]>;

  /**
   * Submit a transfer. Resolves when the transfer reaches a terminal state
   * (confirmed or failed) — callers must not assume success.
   */
  send(request: SendRequest): Promise<SendResult>;
}
