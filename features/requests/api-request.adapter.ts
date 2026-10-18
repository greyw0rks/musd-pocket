/**
 * The real request adapter — and its limits, which are not small.
 *
 * The server's `PaymentRequest` and the UI's `PaymentRequest` are different
 * things that happen to share a name. The server model is a **shareable
 * pay-link**: the creator names a recipient *address* and an amount, and
 * anybody holding the link can pay it by submitting a transaction hash that
 * the server then verifies on-chain. It has no counterparty, no direction, and
 * no per-user incoming queue — `listByCreator` filters on the creator alone.
 *
 * The UI model assumes a two-sided conversation: `direction` is
 * `"incoming" | "outgoing"`, and an incoming request is somebody asking *you*
 * for money. There is nowhere on the server to record that, and no query that
 * could return it.
 *
 * So this adapter implements the half that is real and refuses the half that
 * is not:
 *
 *   list()    real — the caller's own outgoing requests.
 *   create()  real — a pay-link to a resolved address.
 *   pay()     refused — an incoming request cannot be listed, so there is no
 *             id this could ever be called with. The server *does* have a payer
 *             path (`/[shortId]/pay`); what is missing is any way to surface a
 *             request that somebody else made. Wiring it now would be code that
 *             cannot run.
 *   decline() refused — `RequestStatus` has no DECLINED. A schema change.
 *   cancel()  refused — same, no CANCELLED.
 *
 * The refusals throw or return `{ok:false}` rather than resolving quietly,
 * because a request that appears to have been declined when nothing happened
 * is the exact failure this codebase keeps insisting on avoiding. They are also
 * declared in `capabilities`, so the screens do not draw the controls at all:
 * a throw is the backstop for a caller that ignored the flag, not the normal
 * path.
 *
 * What incoming support needs (Milestone 3, with the receiving work): a
 * recipient-side field on the model, an index to query by it, a way to reach a
 * counterparty who is not a Pocket user, and a decision about how a link gets
 * delivered. That is a design task before it is a coding one.
 */

import { type AuthedFetch } from "@/lib/auth/client";
import { parseDecimalToUnits, unitsToDecimal } from "@/features/payments/amount";
import type { PaymentService } from "@/features/payments/payment.types";
import type {
  CreateRequestInput,
  CreateRequestResult,
  PaymentRequest,
  RequestService,
  SettleRequestResult,
} from "./request.types";

/** One row of `GET /api/requests` — `lib/requests/serialize.ts`. */
type SerializedRequest = {
  shortId: string;
  displayId: string;
  creatorAddress: string;
  recipientAddress: string;
  amount: string;
  token: string;
  chainId: number;
  description: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "EXPIRED";
  txHash: string | null;
  payerAddress: string | null;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
};

/**
 * A stand-in for "never expires".
 *
 * `PaymentRequest.expiresAt` is a required `Date`, and the server stores `null`
 * for a link that never expires. Rather than leave the field undefined and let
 * a screen render "Invalid Date", an open-ended request gets a date far enough
 * out that no comparison in the UI will ever treat it as expired. It is a
 * sentinel and it is documented as one — it is not a claim about a real date.
 */
const NEVER_EXPIRES = new Date("9999-12-31T00:00:00.000Z");

function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toPaymentRequest(row: SerializedRequest): PaymentRequest {
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : NEVER_EXPIRES;

  /*
    Expiry is derived, not stored. The server leaves a lapsed PENDING row as
    PENDING; treating it as expired here is a statement about the clock, which
    is knowable, rather than about the ledger, which is the server's business.
  */
  const status =
    row.status === "PAID"
      ? "paid"
      : row.status === "EXPIRED"
        ? "expired"
        : expiresAt.getTime() < Date.now()
          ? "expired"
          : "open";

  const amountUnits = parseDecimalToUnits(row.amount) ?? 0n;
  const name = shorten(row.recipientAddress);

  return {
    id: row.shortId,
    // Every request this adapter can return was created by the signed-in user.
    // There is no other kind available — see the header.
    direction: "outgoing",
    counterpartyId: row.recipientAddress,
    counterpartyName: name,
    counterpartyHandle: name,
    amountUnits,
    ...(row.description ? { note: row.description } : {}),
    status,
    kind: "onchain",
    createdAt: new Date(row.createdAt),
    expiresAt,
    ...(row.paidAt ? { settledAt: new Date(row.paidAt) } : {}),
  };
}

export function createApiRequestService(deps: {
  fetchAuthed: AuthedFetch;
  /** Kept for interface parity: a request never moves money by itself. */
  payments: PaymentService;
}): RequestService {
  const { fetchAuthed } = deps;

  return {
    async list(): Promise<PaymentRequest[]> {
      const rows = await fetchAuthed<SerializedRequest[]>("/api/requests");
      return rows
        .map(toPaymentRequest)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async create(input: CreateRequestInput): Promise<CreateRequestResult> {
      if (input.amountUnits <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }

      // The server stores an address. A contact with no resolved address is
      // therefore not something a request can be made to, and saying so here
      // is the same answer a round-trip would give, sooner.
      const recipientAddress = input.counterparty.address;
      if (!recipientAddress) {
        return {
          ok: false,
          error: "That contact has no address yet, so there is nobody to ask.",
        };
      }

      try {
        const row = await fetchAuthed<SerializedRequest>("/api/requests", {
          method: "POST",
          body: JSON.stringify({
            recipientAddress,
            amount: unitsToDecimal(input.amountUnits),
            ...(input.note ? { description: input.note } : {}),
          }),
        });
        return { ok: true, request: toPaymentRequest(row) };
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof Error && e.message
              ? e.message
              : "Could not create that request.",
        };
      }
    },

    async pay(_id: string): Promise<SettleRequestResult> {
      // Not reachable: `list()` never returns an incoming request, so there is
      // no id here that names somebody else's ask. Refused loudly, because the
      // alternative is a caller that believes it paid.
      return {
        ok: false,
        error:
          "Paying a request from inside Pocket is not available yet — request links are paid by their own holder for now.",
      };
    },

    async decline(_id: string): Promise<PaymentRequest> {
      throw new Error(
        "Declining a request is not available yet: Pocket has no declined state to record it in.",
      );
    },

    async cancel(_id: string): Promise<PaymentRequest> {
      throw new Error(
        "Cancelling a request is not available yet: Pocket has no cancelled state to record it in.",
      );
    },

    /*
      Neither refusal has anywhere to be recorded, so neither is offered. The
      screens read this before drawing "Decline" and "Withdraw request" — see
      `RequestCapabilities`.
    */
    capabilities: { decline: false, withdraw: false },
  };
}
