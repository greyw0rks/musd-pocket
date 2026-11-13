import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const f = vi.hoisted(() => ({ identity: vi.fn(), user: vi.fn(), status: vi.fn(), claim: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/request", async original => ({ ...(await original<object>()), requireIdentity: f.identity }));
vi.mock("@/lib/users/service", () => ({ getUserByWallet: f.user }));
vi.mock("@/lib/rewards/service", () => ({ welcomeRewardStatus: f.status, welcomeClaim: f.claim }));
import { GET, POST } from "@/app/api/rewards/welcome/route";
import { AuthError } from "@/lib/auth/request";

const wallet = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;
const request = () => new NextRequest(`https://mpocket.tech/api/rewards/welcome?txHash=${hash}`);
beforeEach(() => {
  vi.resetAllMocks();
  f.identity.mockResolvedValue({ walletAddress: wallet, privyId: "did:privy:owner" });
  f.user.mockResolvedValue({ walletAddress: wallet });
  f.status.mockResolvedValue({ state: "ready", pendingTxHash: null });
});

describe("retired welcome reward", () => {
  it("refuses old clients without authorizing or sending another reward", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "The welcome reward has ended. Use the testnet faucet to get started." });
    expect(f.identity).not.toHaveBeenCalled();
    expect(f.claim).not.toHaveBeenCalled();
  });
  it("does not advertise a funded campaign as available", async () => {
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ state: "unavailable" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(f.claim).not.toHaveBeenCalled();
  });
  it("keeps a historical claim visible to its authenticated owner", async () => {
    const status = { state: "claimed", claim: { tokenId: "941", amount: "20" }, pendingTxHash: null };
    f.status.mockResolvedValue(status);
    expect(await (await GET(request())).json()).toEqual(status);
    expect(f.status).toHaveBeenCalledWith({ walletAddress: wallet, privyId: "did:privy:owner" }, hash);
    expect(f.claim).not.toHaveBeenCalled();
  });
  it("preserves confirmation recovery for an existing pending reward", async () => {
    const status = { state: "pending", pendingTxHash: hash };
    f.status.mockResolvedValue(status);
    expect(await (await GET(request())).json()).toEqual(status);
    expect(f.claim).not.toHaveBeenCalled();
  });
  it("requires authentication before exposing historical records", async () => {
    f.identity.mockRejectedValue(new AuthError("Sign in", 401));
    expect((await GET(request())).status).toBe(401);
    expect(f.status).not.toHaveBeenCalled();
  });
});
