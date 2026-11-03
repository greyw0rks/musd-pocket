import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";

const fixture = vi.hoisted(() => ({
  payment: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  verify: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { payment: fixture.payment, user: fixture.user },
}));
vi.mock("./verify", () => ({ verifyDirectTransfer: fixture.verify }));
import { recordDirectPayment, reconcileDirectPayments } from "./direct";

const sender = {
  id: "payer",
  walletAddress: "0x1111111111111111111111111111111111111111",
};
const to = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const input = { txHash: hash, recipient: to, amount: "2.25" };
const pending = {
  id: "payment",
  paymentId: hash,
  mode: "DIRECT",
  senderId: sender.id,
  recipientId: null,
  recipientAddress: to,
  amount: new Prisma.Decimal("2.25"),
  chainId: CHAIN_ID,
  token: MUSD_ADDRESS.toLowerCase(),
  status: "PENDING",
  payoutTxHash: hash,
  sender,
};
beforeEach(() => {
  vi.resetAllMocks();
  fixture.payment.findUnique.mockResolvedValue(null);
  fixture.payment.create.mockImplementation(({ data }) =>
    Promise.resolve({ ...pending, ...data }),
  );
  fixture.payment.findUniqueOrThrow.mockResolvedValue({
    ...pending,
    status: "PAID",
    recipientId: "payee",
  });
  fixture.payment.updateMany.mockResolvedValue({ count: 1 });
  fixture.user.findUnique.mockResolvedValue({ id: "payee" });
  fixture.verify.mockResolvedValue({
    valid: true,
    timestamp: 1800000000n,
    from: sender.walletAddress,
    blockNumber: 123n,
  });
});

describe("direct payment recording", () => {
  it("verifies the authenticated sender and files exact direct metadata", async () => {
    expect(await recordDirectPayment(sender, input)).toMatchObject({
      status: "PAID",
    });
    expect(fixture.verify).toHaveBeenCalledWith({
      txHash: hash,
      sender: sender.walletAddress,
      recipient: to,
      amount: "2.25",
    });
    expect(fixture.payment.create.mock.calls[0][0].data).toMatchObject({
      mode: "DIRECT",
      chainId: CHAIN_ID,
      token: MUSD_ADDRESS.toLowerCase(),
      recipientAddress: to,
      recipientId: "payee",
      paidAt: new Date(1800000000 * 1000),
    });
  });
  it.each(["0", "-1", "1e3", "1.0000000000000000001", "100000000000000000000"])(
    "rejects invalid amounts before any database or chain call: %s",
    async (amount) => {
      await expect(
        recordDirectPayment(sender, { ...input, amount }),
      ).rejects.toMatchObject({ status: 400 });
      expect(fixture.payment.findUnique).not.toHaveBeenCalled();
      expect(fixture.verify).not.toHaveBeenCalled();
    },
  );
  it("does not reserve unknown hashes", async () => {
    fixture.verify.mockResolvedValue({
      valid: false,
      pending: true,
      verifiedIntent: false,
    });
    expect(await recordDirectPayment(sender, input)).toMatchObject({
      id: null,
      status: "PENDING",
    });
    expect(fixture.payment.create).not.toHaveBeenCalled();
  });
  it("holds readable intent as pending, then verifies it again on retry", async () => {
    fixture.verify.mockResolvedValueOnce({
      valid: false,
      pending: true,
      verifiedIntent: true,
    });
    expect((await recordDirectPayment(sender, input)).status).toBe("PENDING");
    fixture.payment.findUnique.mockResolvedValue(pending);
    expect((await recordDirectPayment(sender, input)).status).toBe("PAID");
    expect(fixture.verify).toHaveBeenCalledTimes(2);
    expect(fixture.payment.updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        mode: "DIRECT",
        status: "PENDING",
        senderId: sender.id,
        chainId: CHAIN_ID,
      },
      data: { status: "PAID", recipientId: "payee" },
    });
  });
  it.each([
    { senderId: "attacker" },
    { recipientAddress: sender.walletAddress },
    { amount: new Prisma.Decimal("3") },
    { mode: "UNCLASSIFIED" },
    { mode: "LEGACY_VAULT" },
    { chainId: 1 },
    { token: to },
  ])(
    "refuses a conflicting existing record before its idempotent path %#",
    async (patch) => {
      fixture.payment.findUnique.mockResolvedValue({
        ...pending,
        status: "PAID",
        ...patch,
      });
      await expect(recordDirectPayment(sender, input)).rejects.toMatchObject({
        status: 409,
      });
      expect(fixture.verify).not.toHaveBeenCalled();
      expect(fixture.payment.updateMany).not.toHaveBeenCalled();
    },
  );
  it("does not overwrite a conflicting concurrent winner", async () => {
    fixture.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...pending, senderId: "attacker" });
    fixture.payment.create.mockRejectedValue({ code: "P2002" });
    await expect(recordDirectPayment(sender, input)).rejects.toMatchObject({
      status: 409,
    });
    expect(fixture.payment.updateMany).not.toHaveBeenCalled();
  });
  it("does not demote a concurrently confirmed payment to pending", async () => {
    fixture.verify.mockResolvedValue({
      valid: false,
      pending: true,
      verifiedIntent: true,
    });
    fixture.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...pending, status: "PAID" });
    fixture.payment.create.mockRejectedValue({ code: "P2002" });
    expect((await recordDirectPayment(sender, input)).status).toBe("PAID");
    expect(fixture.payment.updateMany).not.toHaveBeenCalled();
  });
  it("keeps confirmed retries idempotent only after checking their immutable details", async () => {
    fixture.payment.findUnique.mockResolvedValue({
      ...pending,
      status: "PAID",
    });
    expect(
      await recordDirectPayment(sender, { ...input, amount: "2.2500" }),
    ).toMatchObject({ status: "PAID", idempotent: true });
    expect(fixture.verify).not.toHaveBeenCalled();
  });
  it("does not write mismatching proofs", async () => {
    fixture.verify.mockResolvedValue({ valid: false, reason: "Wrong signer" });
    await expect(recordDirectPayment(sender, input)).rejects.toMatchObject({
      status: 422,
    });
    expect(fixture.payment.create).not.toHaveBeenCalled();
  });
  it("records a confirmed revert as failed without inventing a refund", async () => {
    fixture.verify.mockResolvedValue({
      valid: false,
      reverted: true,
      reason: "Transaction reverted",
    });
    expect((await recordDirectPayment(sender, input)).status).toBe("FAILED");
    expect(fixture.payment.create.mock.calls[0][0].data.paidAt).toBeNull();
  });
});

describe("direct recovery", () => {
  it("scopes user recovery and links the payee when confirmation arrives", async () => {
    fixture.payment.findMany.mockResolvedValue([pending]);
    fixture.payment.findUnique.mockResolvedValue(pending);
    expect(await reconcileDirectPayments(sender.id)).toEqual({
      scanned: 1,
      finalized: 1,
      failed: 0,
      held: 0,
    });
    expect(fixture.payment.findMany.mock.calls[0][0].where).toEqual({
      mode: "DIRECT",
      status: "PENDING",
      senderId: sender.id,
    });
  });
  it("holds unreadable transactions and incompatible rows", async () => {
    fixture.payment.findMany.mockResolvedValue([
      pending,
      { ...pending, chainId: 1 },
    ]);
    fixture.payment.findUnique.mockResolvedValue(pending);
    fixture.verify.mockRejectedValue(new Error("RPC timeout"));
    expect(await reconcileDirectPayments()).toEqual({
      scanned: 2,
      finalized: 0,
      failed: 0,
      held: 2,
    });
    expect(fixture.payment.updateMany).not.toHaveBeenCalled();
  });
  it("counts only a won terminal transition", async () => {
    fixture.payment.findMany.mockResolvedValue([pending]);
    fixture.payment.findUnique.mockResolvedValue(pending);
    fixture.payment.updateMany.mockResolvedValue({ count: 0 });
    expect((await reconcileDirectPayments()).held).toBe(1);
  });
});
