/**
 * The request service boundary.
 *
 * Same shape as the other two, and it takes the payment service as an argument
 * rather than building one — paying a request has to go through the same
 * send path as everything else, and a service that constructed its own
 * payment adapter would be a second place where money moves.
 *
 * Wiring a real one is this file: return a Mezo-backed implementation of the
 * same interface and nothing above changes.
 */

import type { PaymentService, Recipient } from "@/features/payments/payment.types";
import { createDemoRequestService } from "./demo-request.adapter";
import type { RequestService } from "./request.types";

export function createRequestService(
  payments: PaymentService,
  resolveRecipient: (id: string) => Recipient | null,
): RequestService {
  return createDemoRequestService(payments, { resolveRecipient });
}
