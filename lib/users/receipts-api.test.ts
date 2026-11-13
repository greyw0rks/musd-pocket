import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ identity: vi.fn(), privyUser: vi.fn(), upsert: vi.fn(), find: vi.fn(), remove: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/request", async original => ({ ...(await original<object>()), requireIdentity: f.identity }));
vi.mock("@/lib/auth/privy-server", () => ({ getPrivyUser: f.privyUser }));
vi.mock("@/lib/db", () => ({ prisma: { receiptPreference: { upsert: f.upsert, findUnique: f.find, deleteMany: f.remove } } }));
import { PUT, GET, DELETE } from "@/app/api/users/me/receipts/route";
import { AuthError } from "@/lib/auth/request";
const wallet = "0x1111111111111111111111111111111111111111";
const request = (body?: object) => new NextRequest("https://mpocket.tech/api/users/me/receipts", { method: body ? "PUT" : "GET", ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
beforeEach(() => {
  vi.resetAllMocks();
  f.identity.mockResolvedValue({ walletAddress: wallet, privyId: "did:privy:owner" });
  f.privyUser.mockResolvedValue({ google: { email: "Owner@Gmail.com" } });
});
describe("private receipt preferences", () => {
  it("persists a normalized entered email for the authenticated wallet", async () => {
    const response = await PUT(request({ channel: "email", address: " Owner@Example.com " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ channel: "email", address: "owner@example.com" });
    expect(f.upsert).toHaveBeenCalledWith({ where: { walletAddress: wallet }, create: { walletAddress: wallet, channel: "email", address: "owner@example.com" }, update: { channel: "email", address: "owner@example.com" } });
  });
  it("reads the persisted preference after reload and removes it without touching identity", async () => {
    f.find.mockResolvedValue({ channel: "email", address: "owner@example.com" });
    const response = await GET(request());
    expect(await response.json()).toEqual({ channel: "email", address: "owner@example.com" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await DELETE(request())).status).toBe(200);
    expect(f.remove).toHaveBeenCalledWith({ where: { walletAddress: wallet } });
  });
  it("uses Google's trusted account address rather than a client-supplied email", async () => {
    expect((await PUT(request({ channel: "google" }))).status).toBe(200);
    expect(f.privyUser).toHaveBeenCalledWith("did:privy:owner");
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { channel: "google", address: "owner@gmail.com" } }));
    f.upsert.mockClear();
    expect((await PUT(request({ channel: "google", address: "attacker@example.com" }))).status).toBe(400);
    expect(f.upsert).not.toHaveBeenCalled();
  });
  it("rejects an unlinked Google account, invalid email and supplied wallet identity", async () => {
    f.privyUser.mockResolvedValue({ google: null });
    expect((await PUT(request({ channel: "google" }))).status).toBe(409);
    expect((await PUT(request({ channel: "email", address: "invalid" }))).status).toBe(400);
    expect((await PUT(request({ channel: "email", address: "owner@example.com", walletAddress: "attacker" }))).status).toBe(400);
    expect(f.upsert).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated writes and deletes", async () => {
    f.identity.mockRejectedValue(new AuthError("Sign in", 401));
    expect((await PUT(request({ channel: "email", address: "owner@example.com" }))).status).toBe(401);
    expect((await DELETE(request())).status).toBe(401);
    expect(f.upsert).not.toHaveBeenCalled();
    expect(f.remove).not.toHaveBeenCalled();
  });
});
