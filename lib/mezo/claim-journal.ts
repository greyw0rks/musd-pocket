import { CHAIN_ID } from "./config";
import { activeEarn } from "./earn";

const memory = new Map<string, `0x${string}`>();
export type ClaimAttempt = {
  nonce: number;
  fromBlock: string;
  retryable: boolean;
  invalid?: true;
};
const attempts = new Map<string, ClaimAttempt>();
function key(wallet: string) {
  return `pocket:savings-claim:${CHAIN_ID}:${activeEarn.savingsVault.toLowerCase()}:${wallet.toLowerCase()}`;
}
export function pendingClaim(wallet: string): `0x${string}` | null {
  const id = key(wallet);
  try {
    const value = localStorage.getItem(id);
    if (!value) {
      memory.delete(id);
      return null;
    }
    if (value && /^0x[0-9a-f]{64}$/i.test(value)) return value as `0x${string}`;
  } catch {
    /* Memory still covers this page when storage is disabled. */
  }
  return memory.get(id) ?? null;
}
export function rememberClaim(wallet: string, hash: `0x${string}` | null) {
  const id = key(wallet);
  if (hash) memory.set(id, hash);
  else memory.delete(id);
  try {
    if (hash) localStorage.setItem(id, hash);
    else localStorage.removeItem(id);
  } catch {
    /* Keep the in-memory receipt. */
  }
  if (!hash) rememberClaimAttempt(wallet, null);
}

export function pendingClaimAttempt(wallet: string): ClaimAttempt | null {
  const id = `${key(wallet)}:attempt`;
  try {
    const raw = localStorage.getItem(id);
    if (!raw) {
      attempts.delete(id);
      return null;
    }
    try {
      const value = JSON.parse(raw) as ClaimAttempt;
      if (value && Number.isSafeInteger(value.nonce) && value.nonce >= 0 &&
          typeof value.fromBlock === "string" && /^\d+$/.test(value.fromBlock) && typeof value.retryable === "boolean")
        return value;
    } catch { /* Preserve invalid records as a block on another signature. */ }
    return { nonce: 0, fromBlock: "0", retryable: false, invalid: true };
  } catch {
    return attempts.get(id) ?? null;
  }
}

/** Reserve before the wallet prompt, including when its response has no hash. */
export function rememberClaimAttempt(wallet: string, value: ClaimAttempt | null): boolean {
  const id = `${key(wallet)}:attempt`;
  if (value) attempts.set(id, value);
  else attempts.delete(id);
  try {
    if (value) localStorage.setItem(id, JSON.stringify(value));
    else localStorage.removeItem(id);
    return true;
  } catch {
    // Tests/server execution have no browser storage; a browser must save the
    // reservation before a wallet request can outlive this page.
    return typeof window === "undefined";
  }
}
