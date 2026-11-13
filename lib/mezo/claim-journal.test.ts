import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pendingClaim, pendingClaimAttempt, rememberClaim, rememberClaimAttempt } from "./claim-journal";

const wallet = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
});
afterEach(() => { rememberClaim(wallet, null); rememberClaim(other, null); vi.unstubAllGlobals(); });

describe("claim reservations without a wallet response", () => {
  it("persists the nonce and start block, scoped to the correct wallet", () => {
    const attempt = { nonce: 8, fromBlock: "123", retryable: false };
    expect(rememberClaimAttempt(wallet, attempt)).toBe(true);
    expect(JSON.parse([...stored.values()][0])).toEqual(attempt);
    expect(pendingClaimAttempt(wallet)).toEqual(attempt);
    expect(pendingClaimAttempt(other)).toBeNull();
  });
  it("honors recovery cleared by another tab", () => {
    rememberClaimAttempt(wallet, { nonce: 8, fromBlock: "123", retryable: false });
    stored.clear();
    expect(pendingClaimAttempt(wallet)).toBeNull();
  });
  it("honors a confirmed hash cleared by another tab", () => {
    rememberClaim(wallet, `0x${"a".repeat(64)}`);
    stored.clear();
    expect(pendingClaim(wallet)).toBeNull();
  });
  it("keeps corrupted storage as a block on a new signature", () => {
    rememberClaimAttempt(wallet, { nonce: 8, fromBlock: "123", retryable: false });
    stored.set([...stored.keys()][0], "broken JSON");
    expect(pendingClaimAttempt(wallet)).toMatchObject({ retryable: false, invalid: true });
  });
  it("requires durable browser storage before prompting a wallet", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Storage blocked"); } });
    expect(rememberClaimAttempt(wallet, { nonce: 8, fromBlock: "123", retryable: false })).toBe(false);
  });
  it("clears a reservation together with a verified claim", () => {
    rememberClaimAttempt(wallet, { nonce: 8, fromBlock: "123", retryable: false });
    rememberClaim(wallet, null);
    expect(pendingClaimAttempt(wallet)).toBeNull();
  });
});
