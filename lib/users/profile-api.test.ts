import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({
  requireIdentity: vi.fn(),
  getUserByWallet: vi.fn(),
  getUserByUsername: vi.fn(),
  update: vi.fn(),
  createPaymentRequest: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireIdentity: f.requireIdentity,
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { update: f.update } } }));
vi.mock("@/lib/users/service", () => ({
  getUserByWallet: f.getUserByWallet,
  getUserByUsername: f.getUserByUsername,
  serializeUser: (user: unknown) => user,
}));
vi.mock("@/lib/requests/service", () => ({
  createPaymentRequest: f.createPaymentRequest,
}));
vi.mock("@/lib/requests/serialize", () => ({
  serializeRequest: (row: unknown) => row,
}));
import { PATCH } from "@/app/api/users/me/route";
import { POST } from "@/app/api/requests/route";
const owner = "0x1111111111111111111111111111111111111111";
const request = (path: string, body: object) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  f.requireIdentity.mockResolvedValue({ walletAddress: owner });
  f.getUserByWallet.mockResolvedValue({
    id: "my-user",
    username: "alice",
    role: "MERCHANT",
    businessName: "My shop",
  });
  f.getUserByUsername.mockResolvedValue(null);
  f.update.mockImplementation(async ({ data }) => data);
  f.createPaymentRequest.mockImplementation(async (data) => data);
});
describe("authenticated merchant persistence", () => {
  it("updates only the verified user's row", async () => {
    const response = await PATCH(
      request("/api/users/me", {
        accountType: "merchant",
        businessName: "New shop",
      }),
    );
    expect(response.status).toBe(200);
    expect(f.update).toHaveBeenCalledWith({
      where: { id: "my-user" },
      data: { role: "MERCHANT", businessName: "New shop" },
    });
    expect(f.getUserByWallet).toHaveBeenCalledWith(owner);
  });
  it("refuses a supplied payout address instead of mutating identity", async () => {
    expect(
      (
        await PATCH(
          request("/api/users/me", {
            businessName: "Shop",
            walletAddress: "attacker",
          }),
        )
      ).status,
    ).toBe(400);
    expect(f.update).not.toHaveBeenCalled();
  });
  it("snapshots the saved business name while deriving the payee from authentication", async () => {
    const response = await POST(
      request("/api/requests", { amount: "12.50", expiry: "7d" }),
    );
    expect(response.status).toBe(201);
    expect(f.createPaymentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorAddress: owner,
        merchantName: "My shop",
      }),
    );
  });
  it("permits a per-invoice display name without changing the saved profile", async () => {
    expect(
      (
        await POST(
          request("/api/requests", {
            amount: "1",
            merchantName: "Event stall",
          }),
        )
      ).status,
    ).toBe(201);
    expect(f.createPaymentRequest).toHaveBeenCalledWith(
      expect.objectContaining({ merchantName: "Event stall" }),
    );
    expect(f.update).not.toHaveBeenCalled();
  });
});
