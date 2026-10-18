/**
 * Handle rules, shared by the client and the server.
 *
 * These lived only in a client-side fixture list, which was fine while nothing
 * on the server could answer a handle question. Now that `GET
 * /api/users/handle` exists, both sides have to agree on what a handle *is* —
 * otherwise the sign-up screen would accept a name the server rejects, or the
 * reverse.
 *
 * The module is deliberately free of React, `server-only` and storage so that a
 * route handler, a client adapter and a pure validator can all import it.
 */

import type { HandleProblem } from "@/features/session/session.types";

/**
 * Handles that would be confusing or misleading if a user claimed one —
 * the product's own name, its chain, and the names a support desk would use.
 *
 * `alex` was here to protect the seeded persona the fixtures shipped with.
 * There is no seeded persona now, and `alex` is the placeholder on the sign-up
 * screen — reserving the exact name the form suggests would reject it.
 */
export const RESERVED_HANDLES = new Set([
  "pocket",
  "musd",
  "mezo",
  "admin",
  "support",
  "help",
  "official",
]);

export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/** `"@Sarah "` → `"sarah"`. */
export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Validate a handle's *shape* without touching storage, a network, or any list
 * of who already holds it. This is the half both sides can answer offline: the
 * sign-up screen uses it to react as the user types, and the handle route uses
 * it to reject malformed input before it costs a query.
 *
 * Availability is the other half, and it is the caller's job — `getUserByUsername`
 * on the server, `GET /api/users/handle` from the client.
 */
export function validateHandleFormat(raw: string): HandleProblem {
  const handle = normaliseHandle(raw);

  if (handle.length === 0) return "Pick a username.";
  if (handle.length < 3) return "Usernames are at least 3 characters.";
  if (handle.length > 20) return "Usernames are at most 20 characters.";
  if (!HANDLE_PATTERN.test(handle))
    return "Use lowercase letters, numbers and underscores only.";
  if (RESERVED_HANDLES.has(handle)) return "That username is reserved.";

  return null;
}
