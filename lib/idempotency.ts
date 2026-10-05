"use client";

import { useRef, useCallback } from "react";
import { ApiError } from "@/lib/auth/client";

/**
 * A stable idempotency key for a money-moving action (send / withdraw). The key
 * is held across retries so the server dedupes a repeated attempt, and rotated
 * only when the attempt reaches a TERMINAL outcome where no funds moved:
 *   - success              → rotate (the next action is a brand-new one).
 *   - 400 / 404 / 502       → rotate (bad input or a reverted release — nothing
 *                             moved, so a retry should be a fresh attempt).
 *   - network error / other → KEEP (ambiguous: the release may be in flight, so a
 *                             retry must reuse the key and dedupe on-chain / in DB).
 *
 * Send `current()` in the request body as `idempotencyKey`; call `rotate()` on
 * success and `settleError(err)` in the catch.
 */
const ROTATE_ON_STATUS = new Set([400, 404, 502]);

export function useIdempotencyKey() {
  const ref = useRef<string | null>(null);

  const current = useCallback(() => {
    if (!ref.current) ref.current = crypto.randomUUID();
    return ref.current;
  }, []);

  const rotate = useCallback(() => {
    ref.current = null;
  }, []);

  const settleError = useCallback((err: unknown) => {
    const status = err instanceof ApiError ? err.status : undefined;
    if (status !== undefined && ROTATE_ON_STATUS.has(status)) {
      ref.current = null;
    }
  }, []);

  return { current, rotate, settleError };
}
