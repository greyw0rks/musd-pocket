import { describe, expect, it, vi } from "vitest";
import type { WalletClient } from "viem";
import { assertCurrentSigner, sessionWallet } from "./session-wallet";
const owner = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const makeWallet = () => ({ account: { address: owner }, chain: { id: 31611 }, getChainId: vi.fn(async () => 31611), getAddresses: vi.fn(async () => [owner]) }) as unknown as WalletClient;
describe("Pocket signing identity", () => {
  it("rejects another cached wallet, a stale chain and a signed-out session", () => {
    const wallet = makeWallet();
    expect(sessionWallet(wallet, owner.toUpperCase())).toBe(wallet);
    expect(sessionWallet(wallet, other)).toBeNull();
    expect(sessionWallet(wallet, null)).toBeNull();
    expect(sessionWallet({ ...wallet, chain: { id: 1 } } as WalletClient, owner)).toBeNull();
  });
  it("requires the RPC and provider to agree on Mezo", async () => {
    const wallet = makeWallet();
    await expect(assertCurrentSigner(wallet, () => wallet, { getChainId: async () => 1 })).rejects.toThrow("Mezo");
    vi.mocked(wallet.getChainId).mockResolvedValue(1);
    await expect(assertCurrentSigner(wallet, () => wallet, { getChainId: async () => 31611 })).rejects.toThrow("Mezo");
  });
  it("rechecks session identity after async network verification", async () => {
    const wallet = makeWallet();
    let current: WalletClient | null = wallet;
    await expect(assertCurrentSigner(wallet, () => current, { getChainId: async () => { current = null; return 31611; } })).rejects.toThrow("wallet changed");
  });
});
