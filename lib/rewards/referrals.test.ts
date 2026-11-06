import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ referralCode: { findUnique: vi.fn(), upsert: vi.fn() }, referral: { findUnique: vi.fn(), upsert: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
import { acceptReferral } from "./referrals";
import type { User } from "@prisma/client";

const code = "a".repeat(24);
const now = new Date("2026-11-06T12:00:00Z");
const user = { id: "new-user", createdAt: new Date("2026-11-06T11:58:00Z") } as User;
beforeEach(() => { vi.clearAllMocks(); db.referralCode.findUnique.mockResolvedValue({ userId: "inviter", createdAt: new Date("2026-11-05T12:00:00Z") }); db.referral.findUnique.mockResolvedValue(null); db.referral.upsert.mockResolvedValue({ inviterId: "inviter" }); });
describe("verified signup attribution", () => {
  it("credits a new account once, using signup time", async () => {
    expect(await acceptReferral(user, code, now)).toEqual({ accepted: true });
    expect(db.referral.upsert.mock.calls[0][0].create).toEqual({ invitedId: user.id, inviterId: "inviter", joinedAt: user.createdAt });
    db.referral.findUnique.mockResolvedValue({ inviterId: "inviter" });
    expect(await acceptReferral(user, code, new Date("2026-11-12T12:00:00Z"))).toEqual({ accepted: true });
    expect(db.referral.upsert).toHaveBeenCalledTimes(1);
  });
  it("refuses self-referrals, old users and malformed links", async () => {
    await expect(acceptReferral({ ...user, id: "inviter" }, code, now)).rejects.toThrow("own invite");
    await expect(acceptReferral({ ...user, createdAt: new Date("2026-11-01") }, code, now)).rejects.toThrow("new Pocket");
    await expect(acceptReferral(user, code, new Date("2026-11-07"))).rejects.toThrow("new Pocket");
    await expect(acceptReferral(user, "bad", now)).rejects.toThrow("Invalid invite");
    expect(db.referral.upsert).not.toHaveBeenCalled();
  });
  it("does not reattribute an account already credited to someone else", async () => {
    db.referral.findUnique.mockResolvedValue({ inviterId: "first-inviter" });
    expect(await acceptReferral(user, code, now)).toEqual({ accepted: false });
    expect(db.referral.upsert).not.toHaveBeenCalled();
  });
});
