"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Client-side authed fetch. Attaches the Privy access token as a Bearer header
 * so API routes can `requireIdentity(req)`. Only usable inside the Privy stack
 * (app pages render behind AuthGate, which guarantees it). Throws with the
 * server's `{ error }` message on a non-2xx response; the thrown Error carries
 * the HTTP `status` so callers can tell a terminal server decision (money
 * didn't move — safe to retry fresh) from a network error (ambiguous — reuse
 * the idempotency key).
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The shape `useApi()` returns, named so plain modules can depend on it.
 *
 * Adapters live in `features/*` and are not React components, so they cannot
 * call the hook themselves — they are handed the function. Without a name for
 * it, each adapter would declare its own structurally-identical copy and the
 * four of them could drift apart. This is that name.
 */
export type AuthedFetch = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export function useApi(): AuthedFetch {
  const { getAccessToken } = usePrivy();

  return useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(path, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || "Request failed",
          res.status,
        );
      }
      return data as T;
    },
    [getAccessToken],
  );
}
