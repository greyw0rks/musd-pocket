import { CHAIN_ID } from "./config";
import { activeEarn } from "./earn";

const memory = new Map<string, `0x${string}`>();
function key(wallet: string) {
  return `pocket:savings-claim:${CHAIN_ID}:${activeEarn.savingsVault.toLowerCase()}:${wallet.toLowerCase()}`;
}
export function pendingClaim(wallet: string): `0x${string}` | null {
  const id = key(wallet);
  try {
    const value = localStorage.getItem(id);
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
}
