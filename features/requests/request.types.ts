/**
 * Payment requests.
 *
 * A request is not a payment. It is a question that becomes one when it is
 * answered — and the two are modelled separately because collapsing them is
 * how an app ends up drawing a receipt for money nobody sent.
 *
 * `RequestService` mirrors `PaymentService`, and its `pay` deliberately does
 * not move money itself: it delegates to the payment service. Section 10's rule
 * that the app must not claim a settlement it did not make is easier to keep
 * when there is exactly one place in the codebase where a transfer happens.
 */

import type {
  PaymentKind,
  Recipient,
  Transaction,
} from "@/features/payments/payment.types";

/**
 * Which way the request points, from the signed-in user's point of view.
 *
 * "incoming" is someone asking the user for money — the one that needs an
 * answer. "outgoing" is the user asking someone else, which they can only wait
 * on or withdraw.
 */
export type RequestDirection = "incoming" | "outgoing";

export type RequestStatus =
  | "open"
  | "paid"
  | "declined"
  | "cancelled"
  | "expired";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  paid: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export interface PaymentRequest {
  id: string;
  direction: RequestDirection;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyHandle: string;
  amountUnits: bigint;
  /** What the request is for. Free text, and often the reason it gets paid. */
  note?: string;
  status: RequestStatus;
  /** Never anything but `demo` until a real adapter exists. */
  kind: PaymentKind;
  createdAt: Date;
  /** After this the request is treated as expired rather than open. */
  expiresAt: Date;
  /** Set when it stops being open, whichever way it went. */
  settledAt?: Date;
  /** The ledger entry it became, when it was paid. */
  transactionId?: string;
}

export interface CreateRequestInput {
  counterparty: Recipient;
  amountUnits: bigint;
  note?: string;
}

export type CreateRequestResult =
  | { ok: true; request: PaymentRequest }
  | { ok: false; error: string };

export type SettleRequestResult =
  | { ok: true; request: PaymentRequest; transaction: Transaction }
  | { ok: false; error: string };

export interface RequestService {
  /** Every request, newest first, expired ones already resolved. */
  list(): Promise<PaymentRequest[]>;
  create(input: CreateRequestInput): Promise<CreateRequestResult>;
  /**
   * Pay an incoming request.
   *
   * Returns the transaction as well as the request, because the caller has to
   * show a receipt and must not have to look up what it just created.
   */
  pay(id: string): Promise<SettleRequestResult>;
  /** Turn down an incoming request. The only honest alternative to paying. */
  decline(id: string): Promise<PaymentRequest>;
  /** Withdraw a request the user made. */
  cancel(id: string): Promise<PaymentRequest>;
}

/** The longest note the composer accepts. */
export const NOTE_MAX_LENGTH = 80;
