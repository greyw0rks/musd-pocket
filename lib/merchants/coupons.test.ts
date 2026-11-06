import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const rows = vi.hoisted(() => new Map());
vi.mock("@/lib/db", () => ({ prisma: { merchantCoupon: { upsert: async ({ where, create }: { where: { id: string }; create: object }) => {
  if (!rows.has(where.id)) rows.set(where.id, { ...create, createdAt: new Date() });
  return rows.get(where.id);
} } } }));
import { issueGreylabsCoupon } from "./coupons";
describe("Greylabs offers", () => {
  it("keeps one fixed discount across retries and concurrent opens", async () => {
    const coupons = await Promise.all(Array.from({ length: 20 }, () => issueGreylabsCoupon("same-account")));
    expect(new Set(coupons.map(c => c.code)).size).toBe(1);
    expect(new Set(coupons.map(c => c.percent)).size).toBe(1);
  });
  it("creates distinct valid codes with random discounts inside 10–30%", async () => {
    const coupons = await Promise.all(Array.from({ length: 100 }, (_, i) => issueGreylabsCoupon(`account-${i}`)));
    expect(new Set(coupons.map(c => c.code)).size).toBe(100);
    for (const coupon of coupons) { expect(coupon.code).toMatch(/^GREY-[A-F0-9]{16}$/); expect(coupon.percent).toBeGreaterThanOrEqual(10); expect(coupon.percent).toBeLessThanOrEqual(30); }
  });
});
