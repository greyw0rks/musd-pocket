import { beforeEach, describe, expect, it, vi } from "vitest";
import { accruedYield, claimPayout } from "./earn-math";
const f = vi.hoisted(() => ({
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
}));
vi.mock("./musd", () => ({
  MUSD_ABI: [],
  getPublicClient: () => ({ ...f, getBlockNumber: async () => 55n }),
}));
import { activeEarn, getEarnPosition, readClaimableYield } from "./earn";
import { createEarnActions } from "./earn-actions";
import { pendingClaim, rememberClaim } from "./claim-journal";
import type { WalletClient } from "viem";
const wallet = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const unit = 10n ** 18n;
const actions = createEarnActions({
  getWalletClient: () =>
    ({
      account: { address: wallet },
      chain: { id: 31611 },
      writeContract: f.writeContract,
    }) as unknown as WalletClient,
});
beforeEach(() => {
  vi.resetAllMocks();
  rememberClaim(wallet, null);
  f.readContract.mockImplementation(
    async ({ functionName }) =>
      ({
        balanceOf: 2000n * unit,
        totalSupply: 8000n * unit,
        claimableYield: 0n,
        yieldIndex: unit + unit / 10n,
        supplyYieldIndex: unit,
        vaultGauge: "0x2222222222222222222222222222222222222222",
        gaugeYieldClaimCap: unit,
      })[functionName as string],
  );
  f.simulateContract.mockResolvedValue({
    request: { address: activeEarn.savingsVault },
    result: 200n * unit,
  });
  f.writeContract.mockResolvedValue(hash);
  f.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
});
describe("Savings accounting and claim recovery", () => {
  it("includes uncheckpointed interest even when stored yield is zero", async () => {
    expect(await readClaimableYield(wallet)).toBe(200n * unit);
    expect(
      f.readContract.mock.calls.every(([call]) => call.blockNumber === 55n),
    ).toBe(true);
  });
  it("keeps principal readable and yield unknown on an accounting read failure", async () => {
    const original = f.readContract.getMockImplementation()!;
    f.readContract.mockImplementation((call) =>
      call.functionName === "yieldIndex"
        ? Promise.reject(new Error("offline"))
        : original(call),
    );
    expect(await getEarnPosition(wallet)).toMatchObject({
      principal: 2000n * unit,
      claimableYield: null,
    });
  });
  it("rounds down wei and applies the cap only to the gauge", () => {
    expect(accruedYield(3n, 7n, unit / 2n, 0n)).toBe(8n);
    expect(claimPayout(20n, false, 5n)).toBe(20n);
    expect(claimPayout(20n, true, 5n)).toBe(5n);
    expect(claimPayout(20n, true, 0n)).toBe(20n);
    expect(() => accruedYield(1n, 0n, 1n, 2n)).toThrow();
  });
  it("simulates and claims accrued yield despite a zero stored mapping", async () => {
    expect(await actions.claim()).toEqual({ ok: true, hash });
    expect(f.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "claimYield", account: wallet }),
    );
    expect(f.writeContract).toHaveBeenCalledTimes(1);
    expect(pendingClaim(wallet)).toBeNull();
  });
  it("recovers a saved claim without signing again", async () => {
    rememberClaim(wallet, hash);
    f.getTransaction.mockResolvedValue({
      from: wallet,
      to: activeEarn.savingsVault,
      input: "0x406cf229",
      value: 0n,
    });
    f.getTransactionReceipt.mockResolvedValue({ status: "success" });
    expect(await actions.claim()).toEqual({ ok: true, hash });
    expect(f.writeContract).not.toHaveBeenCalled();
    expect(pendingClaim(wallet)).toBeNull();
  });
  it("does not sign when a fresh simulation would pay nothing", async () => {
    f.simulateContract.mockResolvedValue({ request: {}, result: 0n });
    expect(await actions.claim()).toMatchObject({ ok: false });
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("shares concurrent claim attempts instead of signing twice", async () => {
    const results = await Promise.all([actions.claim(), actions.claim()]);
    expect(results).toEqual([
      { ok: true, hash },
      { ok: true, hash },
    ]);
    expect(f.writeContract).toHaveBeenCalledTimes(1);
  });
  it("retains an unknown receipt and refuses to resend", async () => {
    rememberClaim(wallet, hash);
    f.getTransaction.mockRejectedValue(new Error("offline"));
    expect(await actions.claim()).toMatchObject({ ok: false, hash });
    expect(pendingClaim(wallet)).toBe(hash);
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("rejects a saved transaction belonging to another wallet", async () => {
    rememberClaim(wallet, hash);
    f.getTransaction.mockResolvedValue({
      from: "0x2222222222222222222222222222222222222222",
      to: activeEarn.savingsVault,
      input: "0x406cf229",
      value: 0n,
    });
    expect(await actions.claim()).toMatchObject({ ok: false });
    expect(f.getTransactionReceipt).not.toHaveBeenCalled();
  });
});
