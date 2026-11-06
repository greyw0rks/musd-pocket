import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ merchant: vi.fn(), payment: vi.fn(), coupon: vi.fn(), identity: vi.fn(), user: vi.fn(), issue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: f.merchant }, payment: { findFirst: f.payment }, merchantCoupon: { findUnique: f.coupon } } }));
vi.mock("@/lib/auth/request", async original => ({ ...(await original<object>()), requireIdentity: f.identity }));
vi.mock("@/lib/users/service", () => ({ getUserByWallet: f.user }));
vi.mock("@/lib/merchants/coupons", () => ({ issueGreylabsCoupon: f.issue }));
import { greylabsAccess } from "./access";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { GET, POST } from "@/app/api/merchants/greylabs/coupon/route";
import { AuthError } from "@/lib/auth/request";
const wallet = "0x1111111111111111111111111111111111111111";
const merchant = { id: "merchant", username: "grey_labs", role: "MERCHANT", walletAddress: wallet };
const coupon = { id: "greylabs:buyer", code: "GREY-ABCDEF1234567890", percent: 27, createdAt: new Date("2026-11-06T00:00:00Z") };
const confirmed = { senderId: "buyer", recipientAddress: wallet, mode: "DIRECT", status: "PAID", chainId: CHAIN_ID, token: MUSD_ADDRESS.toLowerCase(), amount: 0.000001, payoutTxHash: "0xconfirmed", paidAt: new Date() };
function recordedPayment(row: Record<string, unknown> | null) {
  f.payment.mockImplementation(async ({ where }) => row && Object.entries(where).every(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      if ("gt" in value) return Number(row[key]) > Number(value.gt);
      if ("not" in value) return row[key] !== value.not;
    }
    return row[key] === value;
  }) ? { id: "confirmed-payment" } : null);
}
beforeEach(() => {
  vi.resetAllMocks();
  f.merchant.mockResolvedValue(merchant);
  f.coupon.mockResolvedValue(coupon);
  f.identity.mockResolvedValue({ walletAddress: wallet, privyId: "did:privy:buyer" });
  f.user.mockResolvedValue({ id: "buyer" });
  f.issue.mockResolvedValue({ code: coupon.code, percent: coupon.percent });
  recordedPayment(confirmed);
});
describe("payment-gated Greylabs offer", () => {
  it("accepts any positive confirmed mUSD payment and restores the fixed account coupon", async () => {
    const access = await greylabsAccess("buyer");
    expect(access).toMatchObject({ eligible: true, recipient: { id: "merchant", handle: "@grey_labs", address: wallet, verified: true }, coupon: { code: coupon.code, percent: 27 } });
    expect(f.merchant).toHaveBeenCalledWith(expect.objectContaining({ where: { username: "grey_labs" } }));
    expect((await greylabsAccess("buyer")).coupon).toEqual(access.coupon);
  });
  it.each([
    ["no payment", null], ["pending", { ...confirmed, status: "PENDING" }],
    ["wrong recipient", { ...confirmed, recipientAddress: "0xother" }],
    ["different sender", { ...confirmed, senderId: "other-buyer" }],
    ["different chain", { ...confirmed, chainId: CHAIN_ID + 1 }],
    ["different token", { ...confirmed, token: "0xother" }],
    ["escrow", { ...confirmed, mode: "ESCROW" }],
    ["zero amount", { ...confirmed, amount: 0 }], ["negative amount", { ...confirmed, amount: -1 }],
    ["missing hash", { ...confirmed, payoutTxHash: null }], ["missing confirmation time", { ...confirmed, paidAt: null }],
  ])("does not unlock for %s or disclose an old free coupon", async (_name, row) => {
    recordedPayment(row);
    expect(await greylabsAccess("buyer")).toMatchObject({ eligible: false, coupon: null });
    expect(f.coupon).not.toHaveBeenCalled();
  });
  it("requires a registered merchant and excludes self payments", async () => {
    expect(await greylabsAccess("merchant")).toMatchObject({ eligible: false, coupon: null });
    f.merchant.mockResolvedValue({ ...merchant, role: "PERSONAL" });
    expect(await greylabsAccess("buyer")).toEqual({ eligible: false, recipient: null, coupon: null });
    expect(f.payment).not.toHaveBeenCalled();
  });
  it("checks payment on GET and blocks direct unpaid POSTs", async () => {
    const req = new Request("https://mpocket.tech/api/merchants/greylabs/coupon");
    recordedPayment(null);
    const access = await GET(req);
    expect(access.headers.get("cache-control")).toBe("private, no-store");
    expect(await access.json()).toMatchObject({ eligible: false, coupon: null });
    expect((await POST(req)).status).toBe(409);
    expect(f.issue).not.toHaveBeenCalled();
    recordedPayment(confirmed);
    expect((await POST(req)).status).toBe(200);
    expect(f.issue).toHaveBeenCalledWith("buyer");
  });
  it("requires authentication for access and issuance", async () => {
    f.identity.mockRejectedValue(new AuthError("Sign in", 401));
    const req = new Request("https://mpocket.tech/api/merchants/greylabs/coupon");
    expect((await GET(req)).status).toBe(401);
    expect((await POST(req)).status).toBe(401);
    expect(f.issue).not.toHaveBeenCalled();
  });
});
