/**
 * Payment domain types.
 *
 * These describe the *shape* of a payment, independent of who performs it.
 * The demo adapter fills them with simulated data; a future Mezo adapter
 * fills the same shapes from real chain reads. Nothing in here knows whether
 * a transfer was real — that distinction lives on `PaymentKind` below, and
 * the UI is required to render it.
 */

/** How a payment was actually performed. The UI must never blur these. */
export type PaymentKind = "demo" | "onchain";

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
 * `amountUnits` is an integer count of minor units (see `amount.ts`) — money
 * is never held as a float. `amountDisplay` is a pre-formatted string for
 * rendering only.
 */
export interface Transaction {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientHandle: string;
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

export interface SendRequest {
  recipient: Recipient;
  amountUnits: bigint;
}

export type SendResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string };

/**
 * The adapter boundary.
 *
 * The UI talks to this interface and never to a chain, a wallet, or a
 * database directly. Swapping the demo implementation for a real one is the
 * whole of Phase 4.
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
