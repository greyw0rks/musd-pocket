/**
 * Demo payment adapter.
 *
 * A self-contained, in-memory implementation of `PaymentService`. It is
 * deliberately the only place in the app that pretends a payment happened,
 * and it always labels what it produces as `kind: "demo"` so the interface
 * can refuse to present it as a real settlement.
 *
 * A real adapter would look nothing like this: it would resolve the
 * recipient, submit a signed transaction, and only reach `confirmed` on a
 * successful receipt — never on a timer.
 */

import type {
  PaymentService,
  SendRequest,
  SendResult,
  Transaction,
} from "./payment.types";
import { formatUnits } from "./amount";
import { DEMO_BALANCE_UNITS, DEMO_TRANSACTIONS } from "@/data/demo-data";

export interface DemoAdapterOptions {
  /** Simulated round-trip time, so the pending state is visible. */
  latencyMs?: number;
  startingBalanceUnits?: bigint;
  seedTransactions?: Transaction[];
}

const FALLBACK_LATENCY_MS = 700;

export function createDemoPaymentService(
  options: DemoAdapterOptions = {},
): PaymentService {
  const latency = options.latencyMs ?? FALLBACK_LATENCY_MS;
  let balance = options.startingBalanceUnits ?? DEMO_BALANCE_UNITS;
  let sequence = 0;

  // A private copy, so two adapters never share history.
  const transactions: Transaction[] = [
    ...(options.seedTransactions ?? DEMO_TRANSACTIONS),
  ];

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    async getBalance() {
      await wait(latency / 2);
      return balance;
    },

    async listTransactions() {
      await wait(latency / 2);
      return [...transactions];
    },

    async send({ recipient, amountUnits }: SendRequest): Promise<SendResult> {
      await wait(latency);

      // The same guards the UI applies, re-checked at the boundary — the
      // service is not allowed to trust its caller.
      if (amountUnits <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }
      if (amountUnits > balance) {
        return { ok: false, error: "That is more than your available balance." };
      }

      balance -= amountUnits;
      sequence += 1;

      const transaction: Transaction = {
        id: `tx_demo_${Date.now()}_${sequence}`,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientHandle: recipient.handle,
        amountUnits,
        amountDisplay: formatUnits(amountUnits),
        direction: "sent",
        status: "confirmed",
        // Never anything else: this adapter cannot produce a real payment.
        kind: "demo",
        createdAt: new Date(),
      };

      transactions.unshift(transaction);
      return { ok: true, transaction };
    },
  };
}
