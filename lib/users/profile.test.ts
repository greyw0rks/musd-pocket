import { describe, expect, it } from "vitest";
import { profileUpdateSchema, profileData } from "./profile";
describe("merchant profile", () => {
  it("normalizes the business name and supports switching account type", () => {
    const input = profileUpdateSchema.parse({
      accountType: "merchant",
      businessName: "  My Shop  ",
    });
    expect(
      profileData(input, { role: "PERSONAL", businessName: null }),
    ).toEqual({ role: "MERCHANT", businessName: "My Shop" });
    expect(
      profileData(
        { accountType: "personal" },
        { role: "MERCHANT", businessName: "My Shop" },
      ),
    ).toEqual({ role: "PERSONAL", businessName: "My Shop" });
  });
  it("rejects identity, payout-address and unknown field changes", () => {
    for (const input of [
      { walletAddress: "0x1234" },
      { role: "ADMIN" },
      { accountType: "admin" },
      { businessName: "x".repeat(81) },
      {},
    ])
      expect(profileUpdateSchema.safeParse(input).success).toBe(false);
  });
  it("can clear a saved business name without changing the username", () => {
    expect(
      profileData(
        { businessName: "" },
        { role: "MERCHANT", businessName: "Old" },
      ),
    ).toEqual({ role: "MERCHANT", businessName: null });
  });
});
