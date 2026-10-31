import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PaymentRequest } from "@prisma/client";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), verify: vi.fn(), record: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { paymentRequest: { findUnique: mocks.findUnique, findMany: mocks.findMany, create: mocks.create, updateMany: mocks.updateMany }, user: { findUnique: mocks.user } } }));
vi.mock("@/lib/auth/request", () => ({ HttpError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock("@/lib/mezo/verify", () => ({ verifyMusdPayment: mocks.verify }));
vi.mock("@/lib/payments/direct", () => ({ recordDirectPayment: mocks.record }));
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { assertRequestPayer, closeRequest, confirmRequestPayment, createPaymentRequest, reconcileRequestPayments } from "./service";

const creator = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const otherHash = `0x${"b".repeat(64)}` as `0x${string}`;
const sender = { id: "payer-id", walletAddress: payer };
let row: PaymentRequest;
beforeEach(() => {
  vi.resetAllMocks();
  row = { id: "invoice-id", shortId: "A".repeat(26), creatorAddress: creator, recipientAddress: creator, intendedPayerAddress: payer, merchantName: null, chainId: CHAIN_ID, token: MUSD_ADDRESS, amount: new Prisma.Decimal(25), status: "PENDING", version: 1, createdAt: new Date(1_000_000), expiresAt: new Date(Date.now() + 60_000), txHash: null, settlementKey: null, description: null, paidAt: null, payerAddress: null };
  mocks.findUnique.mockImplementation(async () => ({ ...row }));
  mocks.updateMany.mockImplementation(async ({ data }) => { Object.assign(row, data, { version: row.version + 1 }); return { count: 1 }; });
  mocks.verify.mockResolvedValue({ valid: true, from: payer, to: creator, value: 25n * 10n ** 18n, logIndex: 3, timestamp: BigInt(Math.floor(Date.now() / 1000)), blockNumber: 42n });
  mocks.create.mockImplementation(async ({ data }) => data);
  mocks.record.mockResolvedValue({ ok: true });
});
describe("invoice authorization and settlement", () => {
  it("pays the requester and records the intended payer separately", async () => {
    const created = await createPaymentRequest({ creatorAddress: creator, intendedPayerAddress: payer, amount: "25" });
    expect(created.recipientAddress).toBe(creator);
    expect(created.intendedPayerAddress).toBe(payer);
    expect(created.shortId).toMatch(/^[A-HJ-NP-Z2-9]{26}$/);
  });
  it("refuses self-pay, wrong payer and wrong network", () => {
    expect(() => assertRequestPayer(row, creator)).toThrow(/own/);
    expect(() => assertRequestPayer(row, "0x3333333333333333333333333333333333333333")).toThrow(/another/);
    expect(() => assertRequestPayer({ ...row, chainId: 1 }, payer)).toThrow(/network/);
  });
  it("never lets an unknown hash reserve an invoice", async () => {
    mocks.verify.mockResolvedValue({ valid: false, pending: true, verifiedIntent: false });
    expect((await confirmRequestPayment(row.shortId, hash, sender)).pending).toBe(true);
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.record).not.toHaveBeenCalled();
  });
  it("reserves only a sender-bound matching intent and refuses another pending hash", async () => {
    mocks.verify.mockResolvedValue({ valid: false, pending: true, verifiedIntent: true });
    await confirmRequestPayment(row.shortId, hash, sender);
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ sender: payer, recipient: creator }));
    expect(row.status).toBe("PROCESSING");
    await expect(confirmRequestPayment(row.shortId, otherHash, sender)).rejects.toMatchObject({ status: 409 });
  });
  it("rejects historical transfers without recording or settling them", async () => {
    mocks.verify.mockResolvedValue({ valid: true, timestamp: 999n });
    await expect(confirmRequestPayment(row.shortId, hash, sender)).rejects.toThrow(/predates/);
    expect(mocks.record).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("settles once using chain, hash and Transfer log and returns repeats idempotently", async () => {
    await confirmRequestPayment(row.shortId, hash, sender);
    expect(row.settlementKey).toBe(`${CHAIN_ID}:${hash}:3`);
    expect(row.status).toBe("PAID");
    await confirmRequestPayment(row.shortId, hash, sender);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
  it("rejects a Transfer log reused to settle another invoice, preserving actual activity", async () => {
    mocks.updateMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" }));
    await expect(confirmRequestPayment(row.shortId, hash, sender)).rejects.toThrow(/another request/);
    expect(mocks.record).toHaveBeenCalled();
  });
  it("labels transfers arriving after expiry or cancellation as late paid", async () => {
    row.status = "CANCELLED";
    await confirmRequestPayment(row.shortId, hash, sender);
    expect(row.status).toBe("LATE_PAID");
    row.status = "EXPIRED"; row.version++; row.expiresAt = new Date(1_000_000);
    await confirmRequestPayment(row.shortId, otherHash, sender);
    expect(row.status).toBe("LATE_PAID");
  });
  it("rejects a lost optimistic settlement race without claiming payment failed", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(confirmRequestPayment(row.shortId, hash, sender)).rejects.toThrow(/transfer was sent/);
    expect(mocks.record).toHaveBeenCalled();
  });
  it("only the creator may cancel and only the intended payer may decline", async () => {
    await expect(closeRequest(row.shortId, payer, "cancel")).rejects.toMatchObject({ status: 403 });
    await expect(closeRequest(row.shortId, creator, "decline")).rejects.toMatchObject({ status: 403 });
    await closeRequest(row.shortId, payer, "decline"); expect(row.status).toBe("DECLINED");
  });
  it("blocks cancellation of a processing invoice and detects cancellation races", async () => {
    row.status = "PROCESSING";
    await expect(closeRequest(row.shortId, creator, "cancel")).rejects.toMatchObject({ status: 409 });
    row.status = "PENDING"; mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(closeRequest(row.shortId, creator, "cancel")).rejects.toThrow(/changed/);
  });
  it("recovers a merchant receipt from the persisted verified payer without a new transfer", async () => {
    row.status = "PROCESSING"; row.txHash = hash; row.payerAddress = payer;
    mocks.findMany.mockResolvedValue([{ ...row }]); mocks.user.mockResolvedValue(sender);
    expect(await reconcileRequestPayments({ creatorAddress: creator }, 1)).toMatchObject({ scanned: 1, finalized: 1 });
    expect(row.status).toBe("PAID");
  });
});
