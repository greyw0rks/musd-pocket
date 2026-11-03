import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fixture = vi.hoisted(() => ({
  identity: vi.fn(),
  user: vi.fn(),
  recover: vi.fn(),
  record: vi.fn(),
  vault: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/privy-server", () => ({
  identityFromToken: fixture.identity,
}));
vi.mock("@/lib/users/service", () => ({ getUserByWallet: fixture.user }));
vi.mock("./direct", () => ({
  recordDirectPayment: fixture.record,
  reconcileDirectPayments: fixture.recover,
}));
vi.mock("@/lib/mezo/vault", () => ({ hasVault: fixture.vault }));
vi.mock("@/lib/settlement/reconcile", () => ({
  RECONCILE_GRACE_MS: 60000,
  reconcile: fixture.legacy,
}));
import { POST as recover } from "@/app/api/payments/recover/route";
import { POST as record } from "@/app/api/payments/record/route";
import { GET as cron } from "@/app/api/cron/reconcile/route";

beforeEach(() => {
  vi.resetAllMocks();
  fixture.identity.mockResolvedValue({ walletAddress: "wallet" });
  fixture.user.mockResolvedValue({ id: "payer", walletAddress: "wallet" });
});
it("requires authentication before recovery or recording", async () => {
  const request = new Request("http://localhost/api/payments/recover", {
    method: "POST",
  });
  expect((await recover(request)).status).toBe(401);
  expect((await record(request)).status).toBe(401);
  expect(fixture.recover).not.toHaveBeenCalled();
  expect(fixture.record).not.toHaveBeenCalled();
});
it("recovers only the verified caller, ignoring supplied sender IDs", async () => {
  fixture.recover.mockResolvedValue({ scanned: 0 });
  await recover(
    new Request("http://localhost/api/payments/recover", {
      method: "POST",
      headers: { authorization: "Bearer fixture" },
      body: JSON.stringify({ senderId: "other" }),
    }),
  );
  expect(fixture.recover).toHaveBeenCalledWith("payer");
});
it("runs direct cron recovery without requiring a vault", async () => {
  vi.stubEnv("CRON_SECRET", "fixture-secret");
  fixture.vault.mockReturnValue(false);
  fixture.recover.mockResolvedValue({
    scanned: 1,
    finalized: 1,
    failed: 0,
    held: 0,
  });
  try {
    const response = await cron(
      new NextRequest("http://localhost/api/cron/reconcile", {
        headers: { authorization: "Bearer fixture-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      finalized: 1,
      direct: { finalized: 1 },
      legacy: { configured: false },
    });
    expect(fixture.legacy).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
