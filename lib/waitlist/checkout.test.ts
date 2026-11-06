import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const fixture = vi.hoisted(() => ({
  merchant: vi.fn(),
  paid: vi.fn(),
  upsert: vi.fn(),
  existing: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: fixture.merchant },
  paymentRequest: { findFirst: fixture.paid, upsert: fixture.upsert, findUnique: fixture.existing },
} }));
vi.mock("@/lib/auth/privy-server", () => ({ identityFromToken: fixture.identity }));
import { getWaitlistCheckout } from "./checkout";
import { WAITLIST_OFFER } from "./offer";
import { POST } from "@/app/api/waitlist/checkout/route";
import { normalizeRequestId } from "@/lib/requests/links";

const payer = "0x2222222222222222222222222222222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  fixture.merchant.mockResolvedValue({ walletAddress: WAITLIST_OFFER.merchantWallet, role: "MERCHANT", businessName: "Pocket" });
  fixture.paid.mockResolvedValue(null);
  fixture.identity.mockResolvedValue({ walletAddress: payer });
  fixture.upsert.mockImplementation(({ create }) => Promise.resolve({
    ...create, amount: new Prisma.Decimal(create.amount), status: "PENDING",
    txHash: null, payerAddress: null, expiresAt: null, paidAt: null, createdAt: new Date(),
  }));
});

describe("waitlist invoice integrity", () => {
  it("requires authentication before touching checkout records", async () => {
    expect((await POST(new Request("http://localhost/api/waitlist/checkout", { method: "POST" }))).status).toBe(401);
    expect(fixture.merchant).not.toHaveBeenCalled();
    expect(fixture.upsert).not.toHaveBeenCalled();
  });
  it("ignores client-supplied price, recipient and payer", async () => {
    const response = await POST(new Request("http://localhost/api/waitlist/checkout", {
      method: "POST", headers: { authorization: "Bearer fixture" },
      body: JSON.stringify({ amount: "1", recipientAddress: payer, walletAddress: WAITLIST_OFFER.merchantWallet }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      amount: "100", recipientAddress: WAITLIST_OFFER.merchantWallet, intendedPayerAddress: payer, chainId: 31611,
    });
  });
  it("reuses one invoice across concurrent opens and leaves saved proofs untouched", async () => {
    const rows = new Map();
    fixture.upsert.mockImplementation(({ where, create, update }) => {
      expect(update).toEqual({});
      if (!rows.has(where.id)) rows.set(where.id, { ...create, status: "PROCESSING", txHash: "saved-proof" });
      return Promise.resolve(rows.get(where.id));
    });
    const [first, second] = await Promise.all([getWaitlistCheckout(payer), getWaitlistCheckout(payer.toUpperCase().replace("0X", "0x"))]);
    expect(first.shortId).toBe(second.shortId);
    expect(normalizeRequestId(first.shortId)).toBe(first.shortId);
    expect(second).toMatchObject({ status: "PROCESSING", txHash: "saved-proof" });
    expect(rows.size).toBe(1);
  });
  it("gives different wallets distinct invoices", async () => {
    await getWaitlistCheckout(payer);
    await getWaitlistCheckout("0x3333333333333333333333333333333333333333");
    expect(fixture.upsert.mock.calls[0][0].where.id).not.toBe(fixture.upsert.mock.calls[1][0].where.id);
  });
  it("recovers the winning invoice if concurrent creation hits a unique constraint", async () => {
    fixture.upsert.mockRejectedValue({ code: "P2002" });
    fixture.existing.mockResolvedValue({ shortId: "existing", status: "PROCESSING", txHash: "saved-proof" });
    expect(await getWaitlistCheckout(payer)).toMatchObject({ status: "PROCESSING", txHash: "saved-proof" });
    expect(fixture.existing).toHaveBeenCalledWith({ where: { id: `${WAITLIST_OFFER.campaign}:${payer}` } });
    expect(fixture.upsert).toHaveBeenCalledTimes(1);
  });
  it("retries only a random link collision and propagates database failures", async () => {
    fixture.upsert.mockRejectedValueOnce({ code: "P2002" });
    fixture.existing.mockResolvedValue(null);
    await getWaitlistCheckout(payer);
    expect(fixture.upsert).toHaveBeenCalledTimes(2);
    fixture.upsert.mockRejectedValue(new Error("Database unavailable"));
    await expect(getWaitlistCheckout(payer)).rejects.toThrow("Database unavailable");
  });
  it("recognizes the existing paid pilot instead of creating another charge", async () => {
    fixture.paid.mockResolvedValue({ shortId: "prior-paid-invoice", status: "PAID", payerAddress: payer });
    expect(await getWaitlistCheckout(payer)).toMatchObject({ shortId: "prior-paid-invoice", status: "PAID" });
    expect(fixture.paid.mock.calls[0][0].where).toMatchObject({ payerAddress: payer, amount: "100", recipientAddress: WAITLIST_OFFER.merchantWallet });
    expect(fixture.upsert).not.toHaveBeenCalled();
  });
  it("refuses a changed merchant wallet or personal profile", async () => {
    fixture.merchant.mockResolvedValue({ walletAddress: payer, role: "MERCHANT", businessName: "Pocket" });
    await expect(getWaitlistCheckout(payer)).rejects.toMatchObject({ status: 503 });
    fixture.merchant.mockResolvedValue({ walletAddress: WAITLIST_OFFER.merchantWallet, role: "PERSONAL", businessName: "Pocket" });
    await expect(getWaitlistCheckout(payer)).rejects.toMatchObject({ status: 503 });
    expect(fixture.upsert).not.toHaveBeenCalled();
  });
  it("refuses the merchant's own wallet", async () => {
    await expect(getWaitlistCheckout(WAITLIST_OFFER.merchantWallet)).rejects.toMatchObject({ status: 409 });
    expect(fixture.upsert).not.toHaveBeenCalled();
  });
});
