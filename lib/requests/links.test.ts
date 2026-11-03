import { describe, expect, it } from "vitest";
import { checkoutPath, normalizeRequestId, parseCheckoutLink } from "./links";
import { createRequestSchema } from "./schema";
import { checkoutBlockReason } from "./rules";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import type { SerializedRequest } from "./serialize";

const id = "A".repeat(24);
const owner = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const invoice: SerializedRequest = {
  shortId: id,
  displayId: `POCKET-${id}`,
  creatorAddress: owner,
  recipientAddress: owner,
  intendedPayerAddress: null,
  merchantName: null,
  version: 2,
  amount: "2.25",
  token: MUSD_ADDRESS,
  chainId: CHAIN_ID,
  description: null,
  status: "PENDING",
  txHash: null,
  payerAddress: null,
  expiresAt: "2030-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  paidAt: null,
};

describe("shareable checkout links", () => {
  it("preserves the invoice and normalizes case", () => {
    expect(normalizeRequestId(id.toLowerCase())).toBe(id);
    expect(
      parseCheckoutLink(
        `https://pocket.example/pay/${id}`,
        "https://pocket.example",
      ),
    ).toBe(checkoutPath(id));
  });
  it.each([
    "https://evil.example/pay/ABCDE",
    "//evil.example/pay/ABCDE",
    "javascript:alert(1)",
    "/pay/../../../home",
    "https://user@pocket.example/pay/ABCDE",
    "/pay/NOT-A-REQUEST",
  ])("rejects unsafe or malformed input %s", (value) => {
    expect(parseCheckoutLink(value, "https://pocket.example")).toBeNull();
  });
});

describe("request intent", () => {
  it("rejects client-selected payees and creators", () => {
    expect(
      createRequestSchema.safeParse({ amount: "2", recipientAddress: payer })
        .success,
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({ amount: "2", creatorAddress: payer })
        .success,
    ).toBe(false);
    expect(
      createRequestSchema.safeParse({
        amount: "2",
        intendedPayerAddress: payer,
      }).success,
    ).toBe(true);
  });
  it.each(["0", "-1", "1e5", "1.1234567890123456789", "100000000000000000000"])(
    "rejects unrepresentable amounts %s",
    (amount) => {
      expect(createRequestSchema.safeParse({ amount }).success).toBe(false);
    },
  );
  it("allows an exact smallest-unit payment", () => {
    expect(
      createRequestSchema.safeParse({ amount: "0.000000000000000001" }).success,
    ).toBe(true);
  });
});

describe("pre-signing checkout checks", () => {
  it("accepts an open compatible invoice for another wallet", () =>
    expect(checkoutBlockReason(invoice, payer)).toBeNull());
  it.each([
    "PAID",
    "LATE_PAID",
    "EXPIRED",
    "CANCELLED",
    "DECLINED",
    "PROCESSING",
  ] as const)("blocks %s before any wallet write", (status) => {
    expect(checkoutBlockReason({ ...invoice, status }, payer)).not.toBeNull();
  });
  it("blocks legacy, wrong-chain, wrong-payer, self, and bound-transaction requests", () => {
    for (const change of [
      { version: 1 },
      { chainId: 1 },
      { intendedPayerAddress: owner },
      { txHash: `0x${"a".repeat(64)}` },
      { expiresAt: "2000-01-01T00:00:00Z" },
    ]) {
      expect(
        checkoutBlockReason({ ...invoice, ...change }, payer),
      ).not.toBeNull();
    }
    expect(checkoutBlockReason(invoice, owner)).not.toBeNull();
  });
});
