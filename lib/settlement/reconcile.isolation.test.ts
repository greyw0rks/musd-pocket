import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  payments: vi.fn(),
  withdrawals: vi.fn(),
  ledger: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    payment: { findMany: fixture.payments },
    withdrawal: { findMany: fixture.withdrawals },
  },
}));
vi.mock("@/lib/ledger/service", () => ({
  LedgerError: class extends Error {},
  ledgerTx: fixture.ledger,
  refundToAvailable: fixture.ledger,
  releaseFrozen: fixture.ledger,
  creditAvailable: fixture.ledger,
}));
vi.mock("@/lib/mezo/musd", () => ({ getPublicClient: fixture.rpc }));
import { reconcile } from "./reconcile";

beforeEach(() => {
  vi.resetAllMocks();
  fixture.withdrawals.mockResolvedValue([]);
});
it("selects explicit vault payments and never processes direct or unclassified rows", async () => {
  fixture.payments.mockResolvedValue([
    { id: "direct", mode: "DIRECT", paymentId: "hash", payoutTxHash: "hash" },
    {
      id: "old",
      mode: "UNCLASSIFIED",
      paymentId: "hash2",
      payoutTxHash: "hash2",
    },
  ]);
  const report = await reconcile();
  expect(fixture.payments.mock.calls[0][0].where).toEqual({
    status: "PENDING",
    mode: "LEGACY_VAULT",
  });
  expect(report.held).toBe(2);
  expect(fixture.ledger).not.toHaveBeenCalled();
  expect(fixture.rpc).not.toHaveBeenCalled();
});
