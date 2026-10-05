import "server-only";
import { randomBytes } from "node:crypto";
import { keccak256, toBytes } from "viem";

/**
 * A fresh bytes32 payment id. Tags the on-chain vault release (payout/withdraw)
 * so the contract's `processed` map rejects a replay, and links the ledger
 * Payment/Transaction rows to the on-chain action.
 *
 * Prefer `paymentIdFromKey` when the client supplies an idempotency key — a
 * fresh random id per request makes a retry look like a brand-new payment and
 * can double-pay. `newPaymentId` is the fallback for callers with no stable key.
 */
export function newPaymentId(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}`;
}

/**
 * Derive a STABLE bytes32 payment id from a client-supplied idempotency key.
 * Same key → same id, so a retried request lands on the same on-chain
 * `processed` slot (reverts the duplicate release) and the same unique
 * `Payment.paymentId` row (rejects the duplicate ledger entry). `scope`
 * namespaces the flow so a payment and a withdrawal can never collide even if
 * a client reuses a raw key across both.
 */
export function paymentIdFromKey(
  key: string,
  scope: "payment" | "withdrawal",
): `0x${string}` {
  return keccak256(toBytes(`${scope}:${key}`));
}
