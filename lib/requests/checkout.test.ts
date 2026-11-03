import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const fixture = vi.hoisted(() => ({
  get: vi.fn(),
  proof: vi.fn(),
  tx: {
    paymentRequest: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    user: { findUnique: vi.fn() },
    payment: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  transaction: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: fixture.transaction,
    paymentRequest: { updateMany: fixture.reset },
  },
}));
vi.mock("./service", () => ({ getByShortId: fixture.get }));
vi.mock("./verify", () => ({ verifyCheckoutTransfer: fixture.proof }));
import { settleCheckout, RevertedCheckoutError } from "./checkout";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { serializeRequest } from "./serialize";
import type { PaymentRequest } from "@prisma/client";

const owner = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}` as const;
const id = "A".repeat(24);
const base = {
  id: "invoice",
  shortId: id,
  creatorAddress: owner,
  recipientAddress: owner,
  intendedPayerAddress: null,
  merchantName: null,
  amount: new Prisma.Decimal("2.25"),
  version: 2,
  chainId: CHAIN_ID,
  token: MUSD_ADDRESS.toLowerCase(),
  status: "PENDING",
  txHash: null,
  settlementKey: null,
  payerAddress: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2026-01-02T00:00:00Z"),
  paidAt: null,
};
const timestamp = BigInt(Date.parse("2026-01-01T01:00:00Z") / 1000);

beforeEach(() => {
  vi.clearAllMocks();
  fixture.get.mockResolvedValue({ ...base });
  fixture.proof.mockResolvedValue({
    valid: true,
    from: payer,
    timestamp,
    blockNumber: 1n,
  });
  fixture.transaction.mockImplementation((callback) => callback(fixture.tx));
  fixture.tx.paymentRequest.updateMany.mockResolvedValue({ count: 1 });
  fixture.tx.paymentRequest.findUniqueOrThrow.mockResolvedValue({
    ...base,
    status: "PAID",
    txHash: hash,
    payerAddress: payer,
  });
  fixture.tx.user.findUnique.mockImplementation(({ where }) =>
    Promise.resolve({
      id: where.walletAddress === payer ? "sender" : "recipient",
    }),
  );
  fixture.tx.payment.findUnique.mockResolvedValue(null);
  fixture.tx.payment.upsert.mockResolvedValue({ id: "activity" });
});

describe("verified invoice settlement", () => {
  it("preserves decimal notation for the smallest token unit in checkout and proof checks", async () => {
    const tiny = {
      ...base,
      description: null,
      amount: new Prisma.Decimal("0.000000000000000001"),
    };
    fixture.get.mockResolvedValue(tiny);
    expect(serializeRequest(tiny as PaymentRequest).amount).toBe(
      "0.000000000000000001",
    );
    await settleCheckout(id, payer, hash);
    expect(fixture.proof.mock.calls[0][0].amount).toBe("0.000000000000000001");
  });
  it("binds the proof to the authenticated payer and creates direct activity atomically", async () => {
    const result = await settleCheckout(id, payer, hash);
    expect(result.pending).toBe(false);
    expect(fixture.proof).toHaveBeenCalledWith({
      txHash: hash,
      sender: payer,
      recipient: owner,
      amount: "2.25",
    });
    expect(
      fixture.tx.paymentRequest.updateMany.mock.calls[0][0].data,
    ).toMatchObject({
      settlementKey: `${CHAIN_ID}:${hash}`,
      status: "PAID",
      payerAddress: payer,
    });
    expect(fixture.tx.payment.upsert.mock.calls[0][0].create).toMatchObject({
      mode: "DIRECT",
      status: "PAID",
      senderId: "sender",
      recipientId: "recipient",
      recipientAddress: owner,
    });
  });
  it("does not reserve an unknown transaction hash", async () => {
    fixture.proof.mockResolvedValue({
      valid: false,
      pending: true,
      verifiedIntent: false,
    });
    expect((await settleCheckout(id, payer, hash)).pending).toBe(true);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });
  it("holds a readable pending transfer without creating paid activity", async () => {
    fixture.proof.mockResolvedValue({
      valid: false,
      pending: true,
      verifiedIntent: true,
    });
    expect((await settleCheckout(id, payer, hash)).pending).toBe(true);
    expect(
      fixture.tx.paymentRequest.updateMany.mock.calls[0][0].data.status,
    ).toBe("PROCESSING");
    expect(fixture.tx.payment.upsert).not.toHaveBeenCalled();
  });
  it("rejects another intended payer before looking up any transaction", async () => {
    fixture.get.mockResolvedValue({ ...base, intendedPayerAddress: owner });
    await expect(settleCheckout(id, payer, hash)).rejects.toMatchObject({
      status: 403,
    });
    expect(fixture.proof).not.toHaveBeenCalled();
  });
  it("rejects old transactions and mismatching proofs without writing", async () => {
    fixture.proof.mockResolvedValue({
      valid: true,
      from: payer,
      timestamp: 1n,
    });
    await expect(settleCheckout(id, payer, hash)).rejects.toThrow("predates");
    fixture.proof.mockResolvedValue({
      valid: false,
      reason: "Wrong recipient",
    });
    await expect(settleCheckout(id, payer, hash)).rejects.toThrow(
      "Wrong recipient",
    );
    expect(fixture.transaction).not.toHaveBeenCalled();
  });
  it("records received funds after expiry as late paid", async () => {
    fixture.get.mockResolvedValue({ ...base, status: "EXPIRED" });
    fixture.proof.mockResolvedValue({
      valid: true,
      from: payer,
      timestamp: timestamp + 172800n,
    });
    await settleCheckout(id, payer, hash);
    expect(
      fixture.tx.paymentRequest.updateMany.mock.calls[0][0].data.status,
    ).toBe("LATE_PAID");
  });
  it("turns a database uniqueness conflict into a refusal to reuse the proof", async () => {
    fixture.transaction.mockRejectedValue({ code: "P2002" });
    await expect(settleCheckout(id, payer, hash)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("another request"),
    });
  });
  it("makes same-proof retries idempotent and refuses other proofs for a paid invoice", async () => {
    fixture.get.mockResolvedValue({
      ...base,
      status: "PAID",
      txHash: hash,
      payerAddress: payer,
    });
    expect((await settleCheckout(id, payer, hash)).pending).toBe(false);
    await expect(
      settleCheckout(id, payer, `0x${"b".repeat(64)}`),
    ).rejects.toMatchObject({ status: 409 });
    expect(fixture.proof).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrently closed request", async () => {
    fixture.tx.paymentRequest.updateMany.mockResolvedValue({ count: 0 });
    fixture.tx.paymentRequest.findUniqueOrThrow.mockResolvedValue({
      ...base,
      status: "CANCELLED",
    });
    await expect(settleCheckout(id, payer, hash)).rejects.toMatchObject({
      status: 409,
    });
    expect(fixture.tx.payment.upsert).not.toHaveBeenCalled();
  });
  it("releases only the caller's matching reverted pending transfer", async () => {
    fixture.proof.mockResolvedValue({
      valid: false,
      reverted: true,
      reason: "Transaction reverted",
    });
    await expect(settleCheckout(id, payer, hash)).rejects.toBeInstanceOf(
      RevertedCheckoutError,
    );
    expect(fixture.reset.mock.calls[0][0].where).toEqual({
      id: base.id,
      status: "PROCESSING",
      txHash: hash,
      payerAddress: payer,
    });
    expect(fixture.reset.mock.calls[0][0].data).toMatchObject({
      txHash: null,
      settlementKey: null,
    });
  });
});
