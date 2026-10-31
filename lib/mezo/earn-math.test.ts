import { describe, expect, it } from "vitest";
import { accruedYield, claimPayout } from "./earn-math";
describe("Savings index accrual", () => {
  it("includes uncheckpointed interest when the stored mapping is zero", () => {
    expect(accruedYield(2000n * 10n ** 18n, 0n, 1093683058673570689n, 10n ** 18n)).toBe(187366117347141378000n);
  });
  it("keeps stored interest after shares are withdrawn", () => { expect(accruedYield(0n, 50n, 200n, 100n)).toBe(50n); });
  it("rounds down fractional wei and rejects an inconsistent index", () => {
    expect(accruedYield(1n, 7n, 2n, 1n)).toBe(7n);
    expect(() => accruedYield(1n, 0n, 1n, 2n)).toThrow();
  });
  it("applies a positive gauge cap only to gauge accounts", () => {
    expect(claimPayout(200n, true, 100n)).toBe(100n);
    expect(claimPayout(200n, false, 100n)).toBe(200n);
    expect(claimPayout(200n, true, 0n)).toBe(200n);
  });
});
