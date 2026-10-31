import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, encodeEventTopics, encodeAbiParameters, erc20Abi } from "viem";
const mocks = vi.hoisted(() => ({ getChainId: vi.fn(), getTransaction: vi.fn(), getTransactionReceipt: vi.fn(), getBlock: vi.fn() }));
vi.mock("@/lib/mezo/musd", async importOriginal => ({ ...await importOriginal<object>(), getPublicClient: () => mocks }));
import { CHAIN_ID, MUSD_ADDRESS } from "./config";
import { verifyMusdPayment } from "./verify";
const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const value = 25n * 10n ** 18n;
const params = { txHash: hash, sender, recipient, amount: "25" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.getChainId.mockResolvedValue(CHAIN_ID);
  mocks.getTransaction.mockResolvedValue({ from: sender, to: MUSD_ADDRESS, value: 0n, input: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, value] }) });
  mocks.getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 42n, logs: [{ address: MUSD_ADDRESS, topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: sender, to: recipient } }), data: encodeAbiParameters([{ type: "uint256" }], [value]), logIndex: 3 }] });
  mocks.getBlock.mockResolvedValue({ timestamp: 1000n });
});
describe("direct mUSD chain proof", () => {
  it("verifies the authenticated sender, calldata, real token log and block time", async () => {
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: true, from: sender, to: recipient, value, logIndex: 3, timestamp: 1000n });
    expect(mocks.getBlock).toHaveBeenCalledWith({ blockNumber: 42n });
  });
  it("fails a wrong RPC chain before querying the transaction", async () => {
    mocks.getChainId.mockResolvedValue(1);
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: false });
    expect(mocks.getTransaction).not.toHaveBeenCalled();
  });
  it("does not treat an unreadable hash as a verified pending transfer", async () => {
    mocks.getTransaction.mockRejectedValue(new Error("not found"));
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: false, pending: true, verifiedIntent: false });
  });
  it("rejects another sender even when the hash otherwise matches", async () => {
    expect(await verifyMusdPayment({ ...params, sender: recipient })).toMatchObject({ valid: false, reason: "That transfer was not sent from your wallet" });
    expect(mocks.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it("rejects mismatched calldata before declaring a pending intent", async () => {
    expect(await verifyMusdPayment({ ...params, amount: "24" })).toMatchObject({ valid: false, reason: "The transfer recipient or amount does not match" });
    expect(mocks.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it("declares pending only after independently verifying the transaction intent", async () => {
    mocks.getTransactionReceipt.mockRejectedValue(new Error("not mined"));
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: false, pending: true, verifiedIntent: true });
  });
  it("rejects a successful receipt containing only a spoofed token event", async () => {
    const receipt = await mocks.getTransactionReceipt(); receipt.logs[0].address = recipient;
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: false });
  });
  it("rejects reverted transactions without recording success", async () => {
    mocks.getTransactionReceipt.mockResolvedValue({ status: "reverted" });
    expect(await verifyMusdPayment(params)).toMatchObject({ valid: false, reason: "Transaction reverted" });
  });
});
