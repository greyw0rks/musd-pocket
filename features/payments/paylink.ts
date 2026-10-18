/**
 * The payment link.
 *
 * One scheme, in one module, because the QR code and the copyable link have to
 * agree and a format written twice is a format that drifts. Everything here is
 * pure so the receive and scan screens can both lean on it without either
 * owning it.
 *
 * The scheme is deliberately *not* a registered one. `pocket:` resolves to
 * nothing on any device today. That is why the receive screen shows the wallet
 * address rather than a link this module could build: a code nothing can pay is
 * worse than an address everything can read. What survives here is the reading
 * side — the scan screen still accepts a handle pasted in any of these shapes.
 */

import { parseDecimalToUnits, unitsToDecimal } from "@/features/payments/amount";

export const PAYLINK_SCHEME = "pocket:";

/**
 * A link for a handle, optionally carrying an amount.
 *
 * An amount is included when the payee asked for a specific figure — a request
 * link lands in the transfer screen with the number already filled in, so the
 * payer confirms rather than retypes.
 */
export function payLink(handle: string, amountUnits?: bigint): string {
  const bare = handle.replace(/^@+/, "");
  if (amountUnits === undefined) return `${PAYLINK_SCHEME}@${bare}`;
  return `${PAYLINK_SCHEME}@${bare}?amount=${unitsToDecimal(amountUnits)}`;
}

export interface ParsedPayLink {
  /** With the leading "@", so it compares directly against a contact. */
  handle: string;
  amountUnits?: bigint;
}

/**
 * Read a link, a bare handle, or a handle with an amount.
 *
 * Accepts the three things a person might paste, because refusing two of them
 * to keep the format pure would put the cost on the user. Anything it cannot
 * make sense of returns `null` — the caller decides what to say, since only it
 * knows what the user was trying to do.
 */
export function parsePayLink(input: string): ParsedPayLink | null {
  const text = input.trim();
  if (!text) return null;

  const withoutScheme = text.startsWith(PAYLINK_SCHEME)
    ? text.slice(PAYLINK_SCHEME.length)
    : text;

  const [rawHandle, rawQuery = ""] = withoutScheme.split("?");
  const handle = rawHandle.trim();
  if (!/^@?[a-zA-Z0-9_]{3,20}$/.test(handle)) return null;

  const params = new URLSearchParams(rawQuery);
  const amount = params.get("amount");

  if (amount === null) {
    return { handle: `@${handle.replace(/^@+/, "").toLowerCase()}` };
  }

  const amountUnits = parseDecimalToUnits(amount);
  if (amountUnits === null || amountUnits <= 0n) return null;

  return {
    handle: `@${handle.replace(/^@+/, "").toLowerCase()}`,
    amountUnits,
  };
}
