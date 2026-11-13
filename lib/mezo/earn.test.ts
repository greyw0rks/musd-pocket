import { beforeEach, describe, expect, it, vi } from "vitest";
import { accruedYield, claimPayout } from "./earn-math";
const f = vi.hoisted(() => ({
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
  getChainId: vi.fn(),
  getAddresses: vi.fn(),
  estimateGas: vi.fn(),
  getGasPrice: vi.fn(),
  getBalance: vi.fn(),
  getTransactionCount: vi.fn(),
  getBlock: vi.fn(),
}));
vi.mock("./musd", async (original) => ({
  ...await original<typeof import("./musd")>(),
  getPublicClient: () => ({ ...f, getBlockNumber: async () => 55n }),
}));
import { activeEarn, getEarnPosition, readClaimableYield } from "./earn";
import { createEarnActions } from "./earn-actions";
import { pendingClaim, pendingClaimAttempt, rememberClaim, rememberClaimAttempt } from "./claim-journal";
import { encodeEventTopics, encodeAbiParameters, type WalletClient } from "viem";
import { MUSD_ABI } from "./musd";
import { MUSD_ADDRESS } from "./config";
const wallet = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const unit = 10n ** 18n;
function claimReceipt(value = 199n * unit) {
  return { status: "success", transactionHash: hash, from: wallet, to: activeEarn.savingsVault, logs: [{
    address: MUSD_ADDRESS,
    topics: encodeEventTopics({ abi: MUSD_ABI, eventName: "Transfer", args: { from: activeEarn.savingsVault, to: wallet } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  }] };
}
const actions = createEarnActions({
  getWalletClient: () =>
    ({
      account: { address: wallet },
      chain: { id: 31611 },
      writeContract: f.writeContract,
      getChainId: f.getChainId,
      getAddresses: f.getAddresses,
    }) as unknown as WalletClient,
});
beforeEach(() => {
  vi.resetAllMocks();
  f.getChainId.mockResolvedValue(31611);
  f.getAddresses.mockResolvedValue([wallet]);
  f.estimateGas.mockResolvedValue(100000n);
  f.getGasPrice.mockResolvedValue(10n);
  f.getBalance.mockResolvedValue(unit);
  f.getTransactionCount.mockResolvedValue(7);
  f.getBlock.mockResolvedValue({ number: 55n, transactions: [{ from: wallet, to: activeEarn.savingsVault, input: "0x406cf229", value: 0n, hash, nonce: 7 }] });
  f.getTransaction.mockResolvedValue({ from: wallet, to: activeEarn.savingsVault, input: "0x406cf229", value: 0n });
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
  f.waitForTransactionReceipt.mockResolvedValue(claimReceipt());
});
describe("Savings accounting and claim recovery", () => {
  it("prepares BTC gas and saves recovery before the wallet prompt", async () => {
    f.writeContract.mockImplementation(async request => {
      expect(request).toMatchObject({ gas: 130000n, gasPrice: 10n, nonce: 7, type: "legacy", chain: { id: 31611 } });
      expect(pendingClaimAttempt(wallet)).toMatchObject({ nonce: 7, retryable: false });
      return hash;
    });
    expect(await actions.claim()).toMatchObject({ ok: true });
    expect(pendingClaimAttempt(wallet)).toBeNull();
  });
  it("refuses the prompt when the fee estimate or BTC balance is unavailable", async () => {
    f.estimateGas.mockRejectedValue(new Error("RPC unavailable"));
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("Nothing was signed") });
    expect(f.writeContract).not.toHaveBeenCalled();
    expect(pendingClaimAttempt(wallet)).toBeNull();
    f.estimateGas.mockResolvedValue(100000n);
    f.getBalance.mockResolvedValue(0n);
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("enough BTC") });
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("recovers a post-confirmation error that contains a transaction hash", async () => {
    f.writeContract.mockRejectedValue(Object.assign(new Error("Provider lost confirmation"), { cause: { transactionHash: hash } }));
    f.getTransactionReceipt.mockResolvedValue(claimReceipt());
    expect(await actions.claim()).toEqual({ ok: true, hash, claimedWei: 199n * unit });
    expect(f.writeContract).toHaveBeenCalledTimes(1);
  });
  it("locates a mined claim by its reserved nonce when the wallet loses the hash", async () => {
    f.writeContract.mockImplementation(async () => {
      f.getTransactionCount.mockResolvedValue(8);
      throw new Error("Provider response timed out after confirmation");
    });
    f.getTransactionReceipt.mockResolvedValue(claimReceipt());
    expect(await actions.claim()).toEqual({ ok: true, hash, claimedWei: 199n * unit });
    expect(f.getBlock).toHaveBeenCalledWith({ blockNumber: 55n, includeTransactions: true });
    expect(f.writeContract).toHaveBeenCalledTimes(1);
  });
  it("keeps an unknown wallet submission and checks it without asking for another signature", async () => {
    f.writeContract.mockImplementation(async () => {
      f.getTransactionCount.mockRejectedValue(new Error("RPC offline"));
      throw new Error("Provider response unavailable");
    });
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("confirmation") });
    expect(pendingClaimAttempt(wallet)).toMatchObject({ nonce: 7, retryable: false });
    expect(actions.hasPendingClaim()).toBe(true);
    expect(await actions.claim()).toMatchObject({ ok: false });
    expect(f.writeContract).toHaveBeenCalledTimes(1);
  });
  it("an explicit retry reuses the original nonce so only one claim can execute", async () => {
    f.writeContract.mockRejectedValueOnce(new Error("Provider did not return a hash"));
    expect(await actions.claim()).toMatchObject({ ok: false });
    expect(actions.canRetryClaim()).toBe(true);
    expect(await actions.claim({ checkOnly: true })).toMatchObject({ ok: false });
    expect(f.writeContract).toHaveBeenCalledTimes(1);
    expect(await actions.claim()).toMatchObject({ ok: true });
    expect(f.writeContract.mock.calls.map(([request]) => request.nonce)).toEqual([7, 7]);
  });
  it("preserves the original uncertain submission when the user cancels a retry", async () => {
    rememberClaimAttempt(wallet, { nonce: 7, fromBlock: "55", retryable: true });
    f.writeContract.mockRejectedValue({ cause: { code: 4001 } });
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("original claim") });
    expect(pendingClaimAttempt(wallet)).not.toBeNull();
  });
  it("recovers the original when it confirms before an explicit retry", async () => {
    rememberClaimAttempt(wallet, { nonce: 7, fromBlock: "55", retryable: true });
    f.getTransactionCount.mockResolvedValue(8);
    f.readContract.mockResolvedValue(0n);
    f.getTransactionReceipt.mockResolvedValue(claimReceipt());
    expect(await actions.claim()).toEqual({ ok: true, hash, claimedWei: 199n * unit });
    expect(pendingClaimAttempt(wallet)).toBeNull();
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("does not reuse retry permission when confirmation cannot be checked", async () => {
    rememberClaimAttempt(wallet, { nonce: 7, fromBlock: "55", retryable: true });
    f.getTransactionCount.mockRejectedValue(new Error("RPC unavailable"));
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("Could not check") });
    expect(pendingClaimAttempt(wallet)).not.toBeNull();
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("clears a newly declined wallet prompt", async () => {
    f.writeContract.mockRejectedValue({ cause: { code: 4001 } });
    expect(await actions.claim()).toMatchObject({ ok: false, error: "You declined. Nothing was signed." });
    expect(pendingClaimAttempt(wallet)).toBeNull();
  });
  it("does not mistake a different transaction at the reserved nonce for a claim", async () => {
    rememberClaimAttempt(wallet, { nonce: 7, fromBlock: "55", retryable: false });
    f.getTransactionCount.mockResolvedValue(8);
    f.getBlock.mockResolvedValue({ transactions: [{ from: wallet, to: MUSD_ADDRESS, input: "0x", value: 0n, hash, nonce: 7 }] });
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("Another wallet transaction") });
    expect(pendingClaimAttempt(wallet)).toBeNull();
    expect(f.writeContract).not.toHaveBeenCalled();
  });
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
    expect(await actions.claim()).toEqual({ ok: true, hash, claimedWei: 199n * unit });
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
    f.getTransactionReceipt.mockResolvedValue(claimReceipt());
    expect(await actions.claim()).toEqual({ ok: true, hash, claimedWei: 199n * unit });
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
      { ok: true, hash, claimedWei: 199n * unit },
      { ok: true, hash, claimedWei: 199n * unit },
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
  it("does not claim success or allow a resend without a proven payout", async () => {
    f.waitForTransactionReceipt.mockResolvedValue({ ...claimReceipt(), logs: [] });
    expect(await actions.claim()).toMatchObject({ ok: false, hash, error: expect.stringContaining("payout could not be verified") });
    expect(pendingClaim(wallet)).toBe(hash);
    f.getTransactionReceipt.mockResolvedValue(claimReceipt());
    expect(await actions.claim()).toMatchObject({ ok: true, claimedWei: 199n * unit });
    expect(f.writeContract).toHaveBeenCalledTimes(1);
  });
  it("ignores zero payouts and transfers of a different token or recipient", async () => {
    const receipt = claimReceipt();
    const wrongRecipient = encodeEventTopics({ abi: MUSD_ABI, eventName: "Transfer", args: { from: activeEarn.savingsVault, to: "0x2222222222222222222222222222222222222222" } });
    f.waitForTransactionReceipt.mockResolvedValue({ ...receipt, logs: [
      { ...receipt.logs[0], address: activeEarn.savingsVault },
      { ...receipt.logs[0], topics: wrongRecipient },
      ...claimReceipt(0n).logs,
    ] });
    expect(await actions.claim()).toMatchObject({ ok: false, hash });
    expect(pendingClaim(wallet)).toBe(hash);
  });
  it("preserves the claim when transaction verification is temporarily unavailable", async () => {
    f.getTransaction.mockRejectedValue(new Error("offline"));
    expect(await actions.claim()).toMatchObject({ ok: false, hash });
    expect(pendingClaim(wallet)).toBe(hash);
  });
  it("clears a proven reverted claim so the next attempt can be reviewed", async () => {
    f.waitForTransactionReceipt.mockResolvedValue({ ...claimReceipt(), status: "reverted", logs: [] });
    expect(await actions.claim()).toMatchObject({ ok: false, hash, error: "The claim reverted. You can try again." });
    expect(pendingClaim(wallet)).toBeNull();
  });
  it("refuses the wrong provider network before reading an empty balance", async () => {
    f.getChainId.mockResolvedValue(1);
    expect(await actions.deposit(unit)).toMatchObject({ ok: false, error: expect.stringContaining("Mezo") });
    expect(f.readContract).not.toHaveBeenCalled();
    expect(f.writeContract).not.toHaveBeenCalled();
  });
  it("refuses a provider account change during claim simulation", async () => {
    f.simulateContract.mockImplementation(async () => {
      f.getAddresses.mockResolvedValue(["0x2222222222222222222222222222222222222222"]);
      return { request: {}, result: unit };
    });
    expect(await actions.claim()).toMatchObject({ ok: false, error: expect.stringContaining("wallet changed") });
    expect(f.writeContract).not.toHaveBeenCalled();
  });
});
