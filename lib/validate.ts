import { getAddress } from "viem";
import type { Address } from "viem";
import { HttpError } from "@/lib/auth/request";

/**
 * Shared request-input validators for the money routes. Throw HttpError (→ 400)
 * on bad input so route handlers can let `errorResponse` surface them.
 */

/** Positive MUSD amount, ≤18 fraction digits. Returns the trimmed string. */
export function validateAmount(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+(\.\d{1,18})?$/.test(value)) {
    throw new HttpError("Enter a valid amount");
  }
  if (Number(value) <= 0) {
    throw new HttpError("Amount must be greater than zero");
  }
  return value;
}

/** Validate + checksum an EVM address, else 400. */
export function validateAddress(raw: unknown): Address {
  if (typeof raw !== "string") throw new HttpError("Enter a valid address");
  try {
    return getAddress(raw.trim());
  } catch {
    throw new HttpError("Enter a valid address");
  }
}
