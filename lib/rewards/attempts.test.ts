import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { welcomeRewardAttempt: db } }));
import { attemptId, reserveAttempt, allowRetry } from "./attempts";
beforeEach(() => vi.resetAllMocks());
const input = {
  id: "claim",
  claimId: "claim",
  chainId: 31611,
  campaign: "CAMPAIGN",
  walletAddress: "WALLET",
};
describe("durable reward reservations", () => {
  it("scopes reservations by network, campaign and account", () => {
    expect(attemptId(31611, "CAMPAIGN", "ID")).toBe("31611:campaign:id");
    expect(attemptId(31612, "CAMPAIGN", "ID")).not.toBe(
      attemptId(31611, "CAMPAIGN", "ID"),
    );
  });
  it("never reopens pending reservations after a unique-key conflict", async () => {
    db.create.mockRejectedValue({ code: "P2002" });
    db.updateMany.mockResolvedValue({ count: 0 });
    expect(await reserveAttempt(input)).toBe(false);
    expect(db.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "claim", walletAddress: "wallet", state: "RETRYABLE" },
      }),
    );
  });
  it("fails closed on database unavailability", async () => {
    db.create.mockRejectedValue(new Error("offline"));
    await expect(reserveAttempt(input)).rejects.toThrow("offline");
    expect(db.updateMany).not.toHaveBeenCalled();
  });
  it("only releases the exact reverted hash", async () => {
    await allowRetry("claim", "0xabc");
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { id: "claim", txHash: "0xabc", state: "BROADCAST" },
      data: { state: "RETRYABLE" },
    });
  });
});
