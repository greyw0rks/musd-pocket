import { describe, it, expect } from "vitest";
import { encodeFunctionData, encodeEventTopics, encodeAbiParameters, erc20Abi, zeroAddress, type Address, type Hex } from "viem";
import { classifyTaskTransaction, isTaskCandidate, taskProgress, weekWindow } from "./weekly";
import { MUSD_ADDRESS, activeBorrow } from "@/lib/mezo/config";
import { BORROWER_OPERATIONS_ABI } from "@/lib/mezo/borrow-write";
import { ROUTER, ROUTER_ABI, FACTORY, POOLS } from "@/lib/mezo/wealth/contracts";

const owner = "0x0000000000000000000000000000000000000011";
const friend = "0x0000000000000000000000000000000000000022";
const transfer = (from: Address, to: Address, amount: bigint, token: Address = MUSD_ADDRESS) => ({
  address: token, topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from, to } }) as Hex[],
  data: encodeAbiParameters([{ type: "uint256" }], [amount]),
});
const send = { from: owner, to: MUSD_ADDRESS, input: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [friend, 10n] }), status: "success", logs: [transfer(owner, friend, 10n)] };

describe("weekly checklist", () => {
  it("resets precisely on Monday UTC across Sunday and year boundaries", () => {
    expect(weekWindow(new Date("2026-11-08T23:59:59Z")).start.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(weekWindow(new Date("2026-11-09T00:00:00Z")).start.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(weekWindow(new Date("2027-01-01T00:00:00Z")).start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
  });
  it("requires five distinct recipients and excludes previous/future weeks", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const events = [
      ...Array.from({ length: 6 }, (_, i) => ({ kind: "send", counterparty: `friend-${i % 4}`, confirmedAt: now })),
      { kind: "send", counterparty: "previous", confirmedAt: new Date("2026-11-01T23:59:59Z") },
      { kind: "send", counterparty: "future", confirmedAt: new Date("2026-11-09T00:00:00Z") },
    ];
    expect(taskProgress(events, 2, now)[0]).toMatchObject({ progress: 4, complete: false });
    expect(taskProgress([...events, { kind: "send", counterparty: "fifth", confirmedAt: now }], 3, now)[0].complete).toBe(true);
    expect(taskProgress(events, 2, now)[1]).toMatchObject({ progress: 2, complete: false });
    expect(taskProgress(events, 20, now)[1]).toMatchObject({ progress: 3, complete: true });
  });
  it("never carries a prior week's completed task into the new checklist", () => {
    const events = [{ kind: "borrow", counterparty: null, confirmedAt: new Date("2026-11-08T23:59:59Z") }];
    expect(taskProgress(events, 0, new Date("2026-11-09T00:00:00Z")).find(t => t.id === "borrow")?.complete).toBe(false);
  });
});

describe("receipt-verified task classification", () => {
  it("skips approvals and unrelated calls before receipt lookup, retaining eligible transfers", () => {
    expect(isTaskCandidate(MUSD_ADDRESS, send.input)).toBe(true);
    expect(isTaskCandidate(MUSD_ADDRESS, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [friend, 10n] }))).toBe(false);
    expect(isTaskCandidate(friend, send.input)).toBe(false);
    expect(isTaskCandidate(MUSD_ADDRESS, "0x1234")).toBe(false);
    // Discovery alone never supplies enough proof to complete a task.
    expect(classifyTaskTransaction(owner, { ...send, logs: [] })).toBeNull();
  });
  it("counts a matching real mUSD transfer and refuses missing/mismatched evidence", () => {
    expect(classifyTaskTransaction(owner, send)).toEqual({ kind: "send", counterparty: friend });
    expect(classifyTaskTransaction(owner, { ...send, logs: [] })).toBeNull();
    expect(classifyTaskTransaction(owner, { ...send, logs: [transfer(owner, friend, 9n)] })).toBeNull();
    expect(classifyTaskTransaction(owner, { ...send, from: friend })).toBeNull();
    expect(classifyTaskTransaction(owner, { ...send, status: "reverted" })).toBeNull();
    expect(classifyTaskTransaction(owner, { ...send, to: friend })).toBeNull();
  });
  it("refuses self transfers, zero amounts, approvals and malformed calldata", () => {
    for (const [to, amount] of [[owner, 10n], [friend, 0n], [zeroAddress, 10n]] as const) {
      expect(classifyTaskTransaction(owner, { ...send, input: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] }), logs: [transfer(owner, to, amount)] })).toBeNull();
    }
    expect(classifyTaskTransaction(owner, { ...send, input: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [friend, 10n] }) })).toBeNull();
    expect(classifyTaskTransaction(owner, { ...send, input: "0x1234" })).toBeNull();
  });
  it("requires the borrower's mint or repayment burn at the real BorrowerOperations", () => {
    const borrow = { ...send, to: activeBorrow.borrowerOperations, input: encodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, functionName: "openTrove", args: [10n, zeroAddress, zeroAddress] }), logs: [transfer(zeroAddress, owner, 10n)] };
    expect(classifyTaskTransaction(owner, borrow)?.kind).toBe("borrow");
    expect(classifyTaskTransaction(owner, { ...borrow, logs: [] })).toBeNull();
    const repay = { ...borrow, input: encodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, functionName: "repayMUSD", args: [10n, zeroAddress, zeroAddress] }), logs: [transfer(owner, zeroAddress, 10n)] };
    expect(classifyTaskTransaction(owner, repay)?.kind).toBe("repay");
    expect(classifyTaskTransaction(owner, { ...repay, logs: [transfer(friend, zeroAddress, 10n)] })).toBeNull();
  });
  it("only counts supported mUSD swaps returning to this wallet through the real factory", () => {
    const pool = POOLS[1];
    const route = { from: pool.token0.address, to: pool.token1.address, stable: pool.stable, factory: FACTORY };
    const swap = (factory: Address = FACTORY, recipient: Address = owner) => ({ ...send, to: ROUTER,
      input: encodeFunctionData({ abi: ROUTER_ABI, functionName: "swapExactTokensForTokens", args: [10n, 1n, [{ ...route, factory }], recipient, 9999999999n] }),
      logs: [transfer(owner, pool.address, 10n)],
    });
    expect(classifyTaskTransaction(owner, swap())?.kind).toBe("swap");
    expect(classifyTaskTransaction(owner, swap(friend))).toBeNull();
    expect(classifyTaskTransaction(owner, swap(FACTORY, friend))).toBeNull();
    expect(classifyTaskTransaction(owner, { ...swap(), logs: [] })).toBeNull();
  });
  it("requires actual LP minting, not only an approval or transfer to a pool", () => {
    const pool = POOLS[1];
    const evidence = { ...send, to: ROUTER,
      input: encodeFunctionData({ abi: ROUTER_ABI, functionName: "addLiquidity", args: [pool.token0.address, pool.token1.address, pool.stable, 10n, 10n, 1n, 1n, owner, 9999999999n] }),
      logs: [transfer(owner, pool.address, 10n), transfer(zeroAddress, owner, 3n, pool.address)],
    };
    expect(classifyTaskTransaction(owner, evidence)?.kind).toBe("pool");
    expect(classifyTaskTransaction(owner, { ...evidence, logs: evidence.logs.slice(0, 1) })).toBeNull();
  });
});
