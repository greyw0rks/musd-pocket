/**
 * The payment service boundary.
 *
 * The interface calls this and nothing else. It must never import a chain
 * client, a wallet SDK, or a database driver directly — that is what keeps
 * the demo replaceable without touching a single component.
 *
 * Phase 4 changes exactly one line in this file: the factory returns a Mezo
 * adapter instead of the demo one. Everything above it stays as-is.
 */

import type { PaymentService } from "./payment.types";
import { createDemoPaymentService } from "./demo-payment.adapter";

/**
 * Build a payment service.
 *
 * Called once per app mount so the demo's balance and history live in a
 * predictable place (React state) rather than in module scope, where hot
 * reload would quietly reset them.
 */
export function createPaymentService(): PaymentService {
  return createDemoPaymentService();
}
