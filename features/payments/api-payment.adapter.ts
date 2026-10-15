/**
 * The real payment adapter.
 *
 * Reads and writes the payment records the server actually holds — the same
 * rows the settlement engine and the reconciler operate on. It is not a
 * simulation of a transfer; it *is* the transfer path, so the honesty rules in
 * `payment.types.ts` apply to it in reverse: it may never emit `kind: "demo"`,
 * because everything it returns came from a real record.
 *
 * What it deliberately does not do:
 *
 *  - it does not invent a failure message. `/api/payments` reports a status,
 *    not a reason, so a failed row comes back `status: "failed"` with no
 *    `error` string rather than a plausible-sounding sentence. Failure copy is
 *    Milestone 2's work.
 *  - it does not decide anything about money. Whether a payment is allowed,
 *    whether the vault can cover it, and whether a broadcast actually landed
 *    are all decided server-side; this adapter's job is to carry the answer.
 */

import { ApiError, type AuthedFetch } from "@/lib/auth/client";
import { parseDecimalToUnits, unitsToDecimal, formatUnits } from "./amount";
import type {
  PaymentService,
  PaymentStatus,
  Recipient,
  SendRequest,
  SendResult,
  Transaction,
} from "./payment.types";
import type { PocketUser } from "@/lib/users/types";

/** One row of `GET /api/payments`. */
type ApiPayment = {
  id: string;
  paymentId: string;
  direction: "sent" | "received";
  amount: string;
  note: string | null;
  destChain: string;
  status: string;
  payoutTxHash: string | null;
  counterparty: string;
  createdAt: string;
};

/** One row of `GET /api/withdrawals`. */
type ApiWithdrawal = {
  id: string;
  amount: string;
  chain: string;
  toAddress: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

type ApiSendResponse = {
  ok: boolean;
  paymentId: string;
  txHash: string | null;
  amount: string;
  counterparty: string;
};

/**
 * Server status → the three states the UI knows.
 *
 * The mapping is deliberately lossy-in-one-direction: several server states
 * collapse into `pending`, and none of them are ever upgraded to `confirmed`
 * on a guess. `UNCLAIMED` — Pocket is holding money for someone who has not
 * joined yet — is `pending`, because from the sender's point of view the money
 * has left and not arrived, which is exactly what "pending" means.
 */
function statusOf(raw: string): PaymentStatus {
  switch (raw) {
    case "PAID":
    case "SETTLED":
    case "COMPLETED":
      return "confirmed";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

/** A truncated address, for showing a counterparty that has no handle. */
function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Split the server's single `counterparty` string into a name and a handle.
 *
 * The server sends `@username` when the other side is a Pocket user, and a raw
 * address when they are not — the only two shapes it produces. A name is
 * derived for each; nothing here invents an identity that was not sent.
 */
function splitCounterparty(value: string): { name: string; handle: string } {
  if (value.startsWith("@")) return { name: value.slice(1), handle: value };
  return { name: shorten(value), handle: shorten(value) };
}

function paymentToTransaction(p: ApiPayment): Transaction {
  const amountUnits = parseDecimalToUnits(p.amount) ?? 0n;
  const { name, handle } = splitCounterparty(p.counterparty);
  return {
    id: p.id,
    // The counterparty string is the only stable identifier the payload
    // carries for the other side; there is no user id on the wire.
    recipientId: p.counterparty,
    recipientName: name,
    recipientHandle: handle,
    amountUnits,
    amountDisplay: formatUnits(amountUnits),
    direction: p.direction,
    status: statusOf(p.status),
    // A row from this adapter is a real record by construction. The question
    // "has it reached a chain yet?" is answered by `status` and by whether
    // `txHash` is present — not by pretending the row is a demo.
    kind: "onchain",
    createdAt: new Date(p.createdAt),
    ...(p.payoutTxHash ? { txHash: p.payoutTxHash } : {}),
  };
}

function withdrawalToTransaction(w: ApiWithdrawal): Transaction {
  const amountUnits = parseDecimalToUnits(w.amount) ?? 0n;
  return {
    id: w.id,
    recipientId: w.toAddress,
    recipientName: shorten(w.toAddress),
    recipientHandle: shorten(w.toAddress),
    amountUnits,
    amountDisplay: formatUnits(amountUnits),
    direction: "sent",
    status: statusOf(w.status),
    kind: "onchain",
    createdAt: new Date(w.createdAt),
    ...(w.txHash ? { txHash: w.txHash } : {}),
  };
}

/** How long a balance read is reused. See `getBalance` below. */
const BALANCE_TTL_MS = 5_000;

export function createApiPaymentService(deps: {
  fetchAuthed: AuthedFetch;
}): PaymentService {
  const { fetchAuthed } = deps;

  /*
    The session adapter reads `/api/users/me` at boot and so does this one, so
    two identical requests would leave the phone at the same moment. A short
    memo collapses them into one. It is nanoseconds-fresh on purpose: a stale
    balance is a lie about money, so the window is small enough that the only
    reads it can absorb are ones already in flight.

    A completed send deliberately does not invalidate it — the send response
    carries the amount, and the caller re-reads once it wants the new figure.
  */
  let balanceCache: { units: bigint; at: number } | null = null;

  return {
    async getBalance(): Promise<bigint> {
      const now = Date.now();
      if (balanceCache && now - balanceCache.at < BALANCE_TTL_MS) {
        return balanceCache.units;
      }
      const user = await fetchAuthed<PocketUser>("/api/users/me");
      const units = parseDecimalToUnits(user.availableBalance) ?? 0n;
      balanceCache = { units, at: now };
      return units;
    },

    async listTransactions(): Promise<Transaction[]> {
      const [payments, withdrawals] = await Promise.all([
        fetchAuthed<{ payments: ApiPayment[] }>("/api/payments"),
        fetchAuthed<{ withdrawals: ApiWithdrawal[] }>("/api/withdrawals"),
      ]);

      // Outgoing withdrawals are money movements too, and leaving them out
      // would mean the history quietly disagreed with the balance.
      return [
        ...payments.payments.map(paymentToTransaction),
        ...withdrawals.withdrawals.map(withdrawalToTransaction),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async send(request: SendRequest): Promise<SendResult> {
      if (request.amountUnits <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }

      // An address is what receives money. A contact with no resolved address
      // is not payable, and saying so here is better than a server round-trip
      // that ends in the same answer with worse copy.
      const target = request.recipient.address ?? request.recipient.handle;
      if (!target) {
        return { ok: false, error: "That contact has no address to pay yet." };
      }

      try {
        const res = await fetchAuthed<ApiSendResponse>("/api/payments", {
          method: "POST",
          body: JSON.stringify({
            amount: unitsToDecimal(request.amountUnits),
            recipient: target,
            ...(request.idempotencyKey
              ? { idempotencyKey: request.idempotencyKey }
              : {}),
          }),
        });

        const { name, handle } = splitCounterparty(
          res.counterparty || target,
        );
        return {
          ok: true,
          transaction: {
            id: res.paymentId,
            recipientId: res.counterparty || target,
            recipientName: name,
            recipientHandle: handle,
            amountUnits: parseDecimalToUnits(res.amount) ?? request.amountUnits,
            amountDisplay: formatUnits(request.amountUnits),
            direction: "sent",
            // The server only answers `ok` once settlement reached a terminal
            // state, so this is confirmed and not pending. A 504 (broadcast,
            // not yet mined) arrives as a thrown ApiError, not a 200.
            status: "confirmed",
            kind: "onchain",
            createdAt: new Date(),
            ...(res.txHash ? { txHash: res.txHash } : {}),
          },
        };
      } catch (e) {
        /*
          A refusal is a value, not an exception, in this interface — the send
          screen already renders `{ok:false, error}` and would otherwise have
          to learn about HTTP. The server's `{error}` copy is passed through
          verbatim: it is the honest explanation ("the vault can't cover this",
          "broadcast but not confirmed"), and replacing it with a generic
          string would throw away the only part the user can act on.
        */
        if (e instanceof ApiError) {
          return { ok: false, error: e.message };
        }
        return {
          ok: false,
          error: "Could not reach Pocket. Check your connection and try again.",
        };
      }
    },
  };
}
