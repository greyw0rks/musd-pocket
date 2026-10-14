/**
 * The session the UI talks to.
 *
 * Identical in shape to `features/payments/payment.service.ts`, and for the
 * same reason: the screens must not know whether a session came from a mock
 * or from an OAuth callback. When a real provider is wired for testnet, this
 * file changes and the forty screens do not.
 */

import { createDemoSessionService } from "@/features/session/demo-session.adapter";
import type { SessionService } from "@/features/session/session.types";

export function createSessionService(): SessionService {
  return createDemoSessionService();
}
