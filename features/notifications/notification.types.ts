/**
 * In-app notifications.
 *
 * Their own domain rather than a projection over the ledger. Most of what this
 * screen has to show is not a payment — a security notice, a note about the
 * build — and modelling those as transactions would force every future kind
 * through a transaction-shaped hole.
 *
 * A notification that *is* about a payment carries the ledger id. That is what
 * lets a tap hand the user to the receipt instead of describing the same event
 * a second time in slightly different words.
 */

export type NotificationKind =
  | "payment_received"
  | "payment_sent"
  | "request_received"
  | "request_paid"
  | "security"
  | "product";

export interface PocketNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  /** The ledger entry this is about, when there is one. */
  transactionId?: string;
  /**
   * The request this is about, when there is one.
   *
   * A tap on a request notice has to land on the request — where the user can
   * pay or decline it — not on a payment that has not happened. That is why
   * this is a second field rather than being folded into `transactionId`.
   */
  requestId?: string;
}
