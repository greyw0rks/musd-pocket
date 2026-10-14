/**
 * Demo request adapter.
 *
 * In-memory, like the payment adapter, and for the same reason: it is the only
 * place that pretends a request exists, and it labels everything it produces
 * `kind: "demo"`.
 *
 * The one thing worth noticing is `pay`. It does not compute a new balance or
 * write a ledger entry of its own — it calls the payment service. So a request
 * that gets paid produces exactly the transaction a direct send would have,
 * through the same guards, and the two can never disagree about what happened.
 */

import type {
  PaymentService,
  Recipient,
} from "@/features/payments/payment.types";
import { DEMO_REQUESTS, REQUEST_WINDOW_MS } from "@/data/demo-data";
import type {
  CreateRequestInput,
  CreateRequestResult,
  PaymentRequest,
  RequestService,
  SettleRequestResult,
} from "./request.types";
import { NOTE_MAX_LENGTH } from "./request.types";

export interface DemoRequestOptions {
  latencyMs?: number;
  seedRequests?: PaymentRequest[];
  /**
   * Turns a request's counterparty id back into a payable recipient.
   *
   * A request keeps the name and handle it was created with, so it stays
   * readable after a contact is deleted — but paying it needs the verified
   * *destination*, and only the contact list has that. Passing the lookup in
   * is what stops this adapter inventing an address for someone it cannot
   * resolve.
   */
  resolveRecipient: (id: string) => Recipient | null;
}

const FALLBACK_LATENCY_MS = 620;

export function createDemoRequestService(
  payments: PaymentService,
  options: DemoRequestOptions,
): RequestService {
  const latency = options.latencyMs ?? FALLBACK_LATENCY_MS;
  let sequence = 0;

  // A private copy, so two adapters never share state.
  const requests: PaymentRequest[] = [...(options.seedRequests ?? DEMO_REQUESTS)];

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * An open request past its window is expired, and saying so on read rather
   * than storing it means a seeded request ages correctly with no timer and
   * nothing to keep in sync.
   */
  function resolve(request: PaymentRequest): PaymentRequest {
    if (request.status !== "open") return request;
    if (request.expiresAt.getTime() > Date.now()) return request;
    return { ...request, status: "expired" };
  }

  function find(id: string): PaymentRequest | null {
    return requests.find((request) => request.id === id) ?? null;
  }

  function replace(next: PaymentRequest) {
    const index = requests.findIndex((request) => request.id === next.id);
    if (index >= 0) requests[index] = next;
  }

  return {
    async list() {
      await wait(latency / 2);
      return requests
        .map(resolve)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async create({
      counterparty,
      amountUnits,
      note,
    }: CreateRequestInput): Promise<CreateRequestResult> {
      await wait(latency);

      if (amountUnits <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }

      const trimmed = note?.trim() ?? "";
      if (trimmed.length > NOTE_MAX_LENGTH) {
        return { ok: false, error: `Keep the note under ${NOTE_MAX_LENGTH} characters.` };
      }

      sequence += 1;
      const now = Date.now();

      const request: PaymentRequest = {
        id: `req_demo_${now}_${sequence}`,
        direction: "outgoing",
        counterpartyId: counterparty.id,
        counterpartyName: counterparty.name,
        counterpartyHandle: counterparty.handle,
        amountUnits,
        note: trimmed || undefined,
        status: "open",
        kind: "demo",
        createdAt: new Date(now),
        expiresAt: new Date(now + REQUEST_WINDOW_MS),
      };

      requests.unshift(request);
      return { ok: true, request };
    },

    async pay(id: string): Promise<SettleRequestResult> {
      const request = find(id);
      if (!request) return { ok: false, error: "That request is gone." };

      const current = resolve(request);
      if (current.direction !== "incoming") {
        // Paying your own request would move money to yourself and mint a
        // receipt for it. Refused at the boundary, not just hidden in the UI.
        return { ok: false, error: "You cannot pay a request you made." };
      }
      if (current.status !== "open") {
        return { ok: false, error: `That request is already ${current.status}.` };
      }

      const recipient = options.resolveRecipient(current.counterpartyId);
      if (!recipient?.address) {
        return {
          ok: false,
          error: "That handle no longer resolves to a destination.",
        };
      }

      // The money moves through the payment service, so this produces the same
      // entry a direct send would and is subject to the same checks.
      const result = await payments.send({
        recipient,
        amountUnits: current.amountUnits,
      });

      if (!result.ok) return { ok: false, error: result.error };

      const settled: PaymentRequest = {
        ...current,
        status: "paid",
        settledAt: new Date(),
        transactionId: result.transaction.id,
      };

      replace(settled);
      return { ok: true, request: settled, transaction: result.transaction };
    },

    async decline(id: string) {
      await wait(latency / 2);
      const request = find(id);
      if (!request) throw new Error("That request is gone.");

      const next = resolve(request);
      if (next.status !== "open") return next;

      const settled: PaymentRequest = {
        ...next,
        status: "declined",
        settledAt: new Date(),
      };
      replace(settled);
      return settled;
    },

    async cancel(id: string) {
      await wait(latency / 2);
      const request = find(id);
      if (!request) throw new Error("That request is gone.");

      const next = resolve(request);
      if (next.status !== "open") return next;

      const settled: PaymentRequest = {
        ...next,
        status: "cancelled",
        settledAt: new Date(),
      };
      replace(settled);
      return settled;
    },
  };
}
