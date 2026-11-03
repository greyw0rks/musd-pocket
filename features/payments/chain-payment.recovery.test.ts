import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletClient } from "viem";
import { createSendJournal } from "./send-journal";
import { CHAIN_ID } from "@/lib/mezo/config";

const fixture = vi.hoisted(() => ({
  rpc: {
    getChainId: vi.fn(),
    simulateContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    readContract: vi.fn(),
  },
  write: vi.fn(),
  fetch: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/mezo/musd", async (original) => ({
  ...(await original<typeof import("@/lib/mezo/musd")>()),
  getPublicClient: () => fixture.rpc,
}));
vi.mock("./api-payment.adapter", () => ({
  createApiPaymentService: () => ({ listTransactions: fixture.history }),
}));
import { createChainPaymentService } from "./chain-payment.adapter";

const sender = "0x1111111111111111111111111111111111111111";
const recipient = {
  id: "customer",
  name: "Customer",
  handle: "@customer",
  verified: true,
  address: "0x2222222222222222222222222222222222222222",
};
const hash = `0x${"a".repeat(64)}` as const;
const request = { recipient, amountUnits: 225n, idempotencyKey: "attempt" };
let values: Map<string, string>;
let storage: Storage;
let recordStatus: string;
let journal: ReturnType<typeof createSendJournal>;
const wallet = () =>
  ({
    account: { address: sender },
    chain: { id: CHAIN_ID },
    writeContract: fixture.write,
  }) as unknown as WalletClient;
const service = (getWalletClient = () => wallet()) =>
  createChainPaymentService({
    fetchAuthed: fixture.fetch,
    getWalletAddress: () => sender,
    getWalletClient,
    journal,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  values = new Map();
  storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  journal = createSendJournal(CHAIN_ID, () => storage);
  fixture.rpc.getChainId.mockResolvedValue(CHAIN_ID);
  fixture.rpc.simulateContract.mockResolvedValue({ result: true });
  fixture.rpc.waitForTransactionReceipt.mockRejectedValue(
    new Error("Timed out"),
  );
  fixture.write.mockResolvedValue(hash);
  fixture.history.mockResolvedValue([]);
  recordStatus = "PENDING";
  fixture.fetch.mockImplementation((path) =>
    Promise.resolve(
      path === "/api/payments/record" ? { status: recordStatus } : {},
    ),
  );
});

describe("send recording recovery", () => {
  it("persists the hash before awaiting any recording or receipt", async () => {
    fixture.fetch.mockImplementation(() => {
      expect(journal.list(sender)[0].hash).toBe(hash);
      return Promise.resolve({ status: "PENDING" });
    });
    const result = await service().send(request);
    expect(result).toMatchObject({
      ok: true,
      transaction: { status: "pending", txHash: hash },
    });
    expect(fixture.write).toHaveBeenCalledTimes(1);
  });
  it("retries a pending hash after reload without a wallet signature", async () => {
    await service().send(request);
    journal = createSendJournal(CHAIN_ID, () => storage);
    recordStatus = "PAID";
    const result = await service().send({
      ...request,
      idempotencyKey: "after-reload",
    });
    expect(result).toMatchObject({
      ok: true,
      transaction: { status: "confirmed", txHash: hash },
    });
    expect(fixture.write).toHaveBeenCalledTimes(1);
    expect(fixture.rpc.simulateContract).toHaveBeenCalledTimes(1);
  });
  it("shares concurrent send attempts and honors an already completed attempt key", async () => {
    recordStatus = "PAID";
    const payments = service();
    const [a, b] = await Promise.all([
      payments.send(request),
      payments.send(request),
    ]);
    expect(a).toEqual(b);
    expect(await payments.send(request)).toEqual(a);
    expect(fixture.write).toHaveBeenCalledTimes(1);
  });
  it("retains a local pending Activity row when recording is offline", async () => {
    fixture.fetch.mockRejectedValue(new Error("Offline"));
    const payments = service();
    await payments.send(request);
    expect(await payments.listTransactions()).toMatchObject([
      { id: hash, status: "pending", txHash: hash },
    ]);
    expect(fixture.write).toHaveBeenCalledTimes(1);
  });
  it("replaces the local placeholder with one server row once verified", async () => {
    const payments = service();
    const sent = await payments.send(request);
    if (!sent.ok) throw new Error("Expected a broadcast");
    recordStatus = "PAID";
    fixture.history.mockResolvedValue([
      { ...sent.transaction, id: "server-record", status: "confirmed" },
    ]);
    const rows = await payments.listTransactions();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("server-record");
    expect(journal.list(sender)).toHaveLength(0);
  });
  it("does not turn a recording refusal into a claim that nothing moved", async () => {
    fixture.fetch.mockRejectedValue(
      Object.assign(new Error("Wrong proof"), { status: 422 }),
    );
    expect(await service().send(request)).toMatchObject({
      ok: true,
      transaction: { status: "pending" },
    });
    expect(journal.list(sender)).toHaveLength(1);
  });
  it("reports a confirmed revert as a failed transaction with its hash", async () => {
    recordStatus = "FAILED";
    expect(await service().send(request)).toMatchObject({
      ok: true,
      transaction: { status: "failed", txHash: hash },
    });
  });
  it("refuses a different signer, missing chain, and storage failure before signing", async () => {
    const wrongWallet = {
      ...wallet(),
      account: { address: recipient.address },
    } as unknown as WalletClient;
    expect((await service(() => wrongWallet).send(request)).ok).toBe(false);
    const noChain = { ...wallet(), chain: undefined };
    expect((await service(() => noChain).send(request)).ok).toBe(false);
    journal = createSendJournal(CHAIN_ID, () => {
      throw new Error("Storage denied");
    });
    expect((await service().send(request)).ok).toBe(false);
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("blocks a competing tab's signature prompt", async () => {
    vi.stubGlobal("navigator", {
      locks: { request: vi.fn((_key, _options, callback) => callback(null)) },
    });
    expect(await service().send(request)).toMatchObject({
      ok: false,
      error: expect.stringContaining("another tab"),
    });
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("refuses amounts beyond storage precision before signing", async () => {
    expect(
      (await service().send({ ...request, amountUnits: 10n ** 22n })).ok,
    ).toBe(false);
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("keeps journal entries isolated by network and wallet", async () => {
    await service().send(request);
    expect(journal.list(recipient.address)).toHaveLength(0);
    expect(createSendJournal(1, () => storage).list(sender)).toHaveLength(0);
  });
});
