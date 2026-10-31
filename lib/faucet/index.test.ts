import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import { FAUCET_ROUND, LEGACY_FAUCET_ROUND } from "./policy";
import type { User } from "@prisma/client";

vi.mock("server-only", () => ({}));
const fixtures = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  btc: 10n ** 18n, locked: false,
  sendTransaction: vi.fn(), writeContract: vi.fn(), waitForTransactionReceipt: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { faucetClaim: {
  findUnique: async ({ where }: { where: { userId_round: { userId: string; round: string } } }) =>
    [...fixtures.rows.values()].find(row => row.userId === where.userId_round.userId && row.round === where.userId_round.round) ?? null,
  findUniqueOrThrow: async ({ where }: { where: { id: string } }) => fixtures.rows.get(where.id),
  create: async ({ data }: { data: Record<string, unknown> }) => {
    const row = { id: `claim-${fixtures.rows.size}`, btcTxHash: null, musdTxHash: null, completedAt: null, claimingAt: null, error: null, ...data };
    fixtures.rows.set(row.id, row);
    return row;
  },
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = { ...fixtures.rows.get(where.id), ...data };
    fixtures.rows.set(where.id, row);
    return row;
  },
  updateMany: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    if (fixtures.locked && data.claimingAt) return { count: 0 };
    const row = fixtures.rows.get(where.id);
    if (!row || row.completedAt) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  },
} } }));
vi.mock("@/lib/relayer", () => ({
  hasRelayer: () => true,
  getRelayerWallet: () => ({ account: { address: "0x2222222222222222222222222222222222222222" }, client: {
    sendTransaction: fixtures.sendTransaction, writeContract: fixtures.writeContract,
    waitForTransactionReceipt: fixtures.waitForTransactionReceipt,
  } }),
}));
vi.mock("@/lib/mezo/musd", async () => {
  const { parseEther } = await import("viem");
  return {
  getPublicClient: () => ({ getBalance: async () => fixtures.btc, readContract: async () => parseEther("1000") }),
  MUSD_ABI: [], parseMusd: parseEther, normalizeAddress: (address: string) => address,
  };
});

import { claimFaucet, faucetStatus } from "./index";
const user = { id: "existing-user", walletAddress: "0x3333333333333333333333333333333333333333" } as User;

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.rows.clear(); fixtures.btc = parseEther("1"); fixtures.locked = false;
  fixtures.rows.set("old-claim", {
    id: "old-claim", userId: user.id, round: LEGACY_FAUCET_ROUND, walletAddress: user.walletAddress,
    btcTxHash: `0x${"1".repeat(64)}`, musdTxHash: `0x${"2".repeat(64)}`,
    completedAt: new Date("2026-10-20T00:00:00Z"), claimingAt: null, error: null,
  });
  fixtures.sendTransaction.mockResolvedValue(`0x${"b".repeat(64)}`);
  fixtures.writeContract.mockResolvedValue(`0x${"c".repeat(64)}`);
  fixtures.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
});

describe("0.06 BTC faucet reset round", () => {
  it("makes old claimants eligible again without deleting their receipts", async () => {
    const old = { ...fixtures.rows.get("old-claim") };
    const view = await faucetStatus(user);
    expect(view.round).toBe(FAUCET_ROUND);
    expect(view.claimed).toBe(false);
    expect(view.claim).toBeNull();
    expect(view.amounts).toEqual({ btc: "0.06", musd: "300" });
    expect(fixtures.rows.get("old-claim")).toEqual(old);
  });
  it("pays the full new allowance once and preserves the original round", async () => {
    const old = { ...fixtures.rows.get("old-claim") };
    expect((await claimFaucet(user)).claimed).toBe(true);
    expect(fixtures.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ value: parseEther("0.06"), to: user.walletAddress }));
    expect(fixtures.writeContract).toHaveBeenCalledWith(expect.objectContaining({ args: [user.walletAddress, parseEther("300")] }));
    expect(fixtures.rows.get("old-claim")).toEqual(old);
    expect([...fixtures.rows.values()].filter(row => row.round === FAUCET_ROUND)).toHaveLength(1);
    expect((await claimFaucet(user)).claimed).toBe(true);
    expect(fixtures.sendTransaction).toHaveBeenCalledTimes(1);
    expect(fixtures.writeContract).toHaveBeenCalledTimes(1);
  });
  it("resumes only the missing leg of this round", async () => {
    fixtures.rows.set("current-partial", {
      id: "current-partial", userId: user.id, round: FAUCET_ROUND, walletAddress: user.walletAddress,
      btcTxHash: `0x${"a".repeat(64)}`, musdTxHash: null, completedAt: null, claimingAt: null, error: null,
    });
    fixtures.btc = parseEther("0.0007");
    expect((await claimFaucet(user)).claimed).toBe(true);
    expect(fixtures.sendTransaction).not.toHaveBeenCalled();
    expect(fixtures.writeContract).toHaveBeenCalledTimes(1);
  });
  it("rejects a concurrent claim that did not win the lease", async () => {
    fixtures.locked = true;
    await expect(claimFaucet(user)).rejects.toMatchObject({ status: 409 });
    expect(fixtures.sendTransaction).not.toHaveBeenCalled();
    expect(fixtures.writeContract).not.toHaveBeenCalled();
  });
  it("requires the increased BTC allowance plus the gas reserve before sending", async () => {
    fixtures.btc = parseEther("0.060499");
    expect((await faucetStatus(user)).funded).toBe(false);
    await expect(claimFaucet(user)).rejects.toMatchObject({ status: 503 });
    expect(fixtures.sendTransaction).not.toHaveBeenCalled();
    expect(fixtures.writeContract).not.toHaveBeenCalled();
  });
  it("keeps broadcast hashes when confirmation times out", async () => {
    fixtures.waitForTransactionReceipt.mockRejectedValue(new Error("RPC timeout"));
    const view = await claimFaucet(user);
    expect(view.claimed).toBe(true);
    expect(view.pending).toBe(true);
    await claimFaucet(user);
    expect(fixtures.sendTransaction).toHaveBeenCalledTimes(1);
    expect(fixtures.writeContract).toHaveBeenCalledTimes(1);
  });
});
