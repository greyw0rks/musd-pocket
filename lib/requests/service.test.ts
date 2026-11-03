import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { paymentRequest: db } }));
import { createPaymentRequest, getByShortId, listForWallet } from "./service";
import { normalizeRequestId } from "./links";

const creator = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const payer = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
beforeEach(() => vi.resetAllMocks());

describe("invoice ownership and retrieval", () => {
  it("derives the payee from the creator while keeping a contact as payer", async () => {
    db.create.mockImplementation(({ data }) => Promise.resolve(data));
    const row = await createPaymentRequest({
      creatorAddress: creator,
      intendedPayerAddress: payer,
      amount: "2.5",
      merchantName: "My store",
      expiresInHours: 168,
    });
    expect(row).toMatchObject({
      creatorAddress: creator.toLowerCase(),
      recipientAddress: creator.toLowerCase(),
      intendedPayerAddress: payer.toLowerCase(),
      version: 2,
    });
    expect(row.shortId).toHaveLength(24);
    expect(normalizeRequestId(row.shortId)).toBe(row.shortId);
    expect(row.expiresAt!.getTime()).toBeGreaterThan(
      Date.now() + 167 * 3600_000,
    );
  });
  it("supports shareable requests without selecting a contact", async () => {
    await createPaymentRequest({ creatorAddress: creator, amount: "1" });
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      recipientAddress: creator.toLowerCase(),
      intendedPayerAddress: null,
    });
  });
  it("refuses self-addressed requests", async () => {
    await expect(
      createPaymentRequest({
        creatorAddress: creator,
        intendedPayerAddress: creator.toLowerCase(),
        amount: "1",
      }),
    ).rejects.toThrow("somebody else");
    expect(db.create).not.toHaveBeenCalled();
  });
  it("does not overwrite a payment that wins a race with lazy expiry", async () => {
    db.findUnique
      .mockResolvedValueOnce({
        id: "invoice",
        status: "PENDING",
        expiresAt: new Date(0),
      })
      .mockResolvedValueOnce({ id: "invoice", status: "PAID" });
    db.updateMany.mockResolvedValue({ count: 0 });
    expect(await getByShortId("A".repeat(24))).toMatchObject({
      status: "PAID",
    });
    expect(db.updateMany.mock.calls[0][0].where).toEqual({
      id: "invoice",
      status: "PENDING",
      txHash: null,
    });
  });
  it("lists both requests created by and addressed to the wallet", async () => {
    await listForWallet(payer);
    expect(db.findMany.mock.calls[0][0].where.OR).toEqual([
      { creatorAddress: payer.toLowerCase() },
      { intendedPayerAddress: payer.toLowerCase() },
    ]);
  });
});
