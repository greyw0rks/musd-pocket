import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  getAddress,
  encodeFunctionResult,
  erc20Abi,
  type Address,
  type WalletClient,
} from "viem";
const f = vi.hoisted(() => ({
  chain: 31611,
  time: 1793635200n,
  block: 77n,
  native: 10n ** 20n,
  balance: 10n ** 23n,
  allowances: new Map<string, bigint>(),
  poolId: "musd-btc",
  empty: false,
  wrongFactory: false,
  upgraded: false,
  owner: "0x1111111111111111111111111111111111111111" as Address,
  holder: "0x1111111111111111111111111111111111111111",
  lockAmount: 20n * 10n ** 18n,
  lockEnd: 1793635200n + 13n * 604800n,
  permanent: false,
  voted: false,
  escrowType: 0,
  vestingEnd: 0n,
  readContract: vi.fn(),
  call: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));
vi.mock("../musd", () => ({
  getPublicClient: () => ({
    getChainId: async () => f.chain,
    getBlock: async () => ({ number: f.block, timestamp: f.time }),
    getGasPrice: async () => 10n,
    getBalance: async () => f.native,
    estimateGas: async () => 50000n,
    getStorageAt: async ({ address, slot }: { address: string; slot: string }) =>
      slot === `0x${"52".padStart(64, "0")}`
        ? `0x${(address.toLowerCase() === "0xb63fccd03521cf21907627bd7fa465c129479231" ? 2592000n : 125798400n).toString(16).padStart(64, "0")}`
        : f.upgraded
        ? "0x00"
        : address.toLowerCase() === "0xb63fccd03521cf21907627bd7fa465c129479231"
          ? "0x0000000000000000000000006bf4894dd2e113682db9d06555a0bfca9892917e"
          : "0x0000000000000000000000009665873019a05bee102903c9df602da06555ae0a",
    readContract: f.readContract,
    call: f.call,
    getTransaction: f.getTransaction,
    getTransactionReceipt: f.getTransactionReceipt,
    waitForTransactionReceipt: f.waitForTransactionReceipt,
    simulateContract: async () => ({ result: [10n ** 15n, 10n ** 10n] }),
  }),
}));
import { exactAmount, minimumAmount, roundedLockEnd } from "./math";
import {
  clearPendingWealth,
  readPendingWealth,
  storePendingWealth,
} from "./journal";
import {
  prepareWealthStep,
  executeWealthStep,
  recoverWealth,
} from "./transactions";
import { quotePool, readPool } from "./pools";
import { quoteLock } from "./lock-actions";
import { quoteSwap } from "./swap";
import {
  ESCROW,
  BTC_ASSET,
  LOCK_CONTRACTS,
  FACTORY,
  LOCK_ABI,
  MAX_LOCK_TIME,
  POOLS,
  ROUTER,
  ROUTER_ABI,
} from "./contracts";
const unit = 10n ** 18n;
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const wallet = {
  account: { address: f.owner },
  chain: { id: 31611 },
  getChainId: async () => f.chain,
  sendTransaction: f.sendTransaction,
} as unknown as WalletClient;
beforeEach(() => {
  vi.resetAllMocks();
  clearPendingWealth(f.owner);
  f.allowances.clear();
  f.chain = 31611;
  f.time = 1793635200n;
  f.native = 100n * unit;
  f.balance = 100000n * unit;
  f.poolId = "musd-btc";
  f.empty = false;
  f.wrongFactory = false;
  f.upgraded = false;
  f.holder = f.owner;
  f.lockAmount = 20n * unit;
  f.lockEnd = f.time + 3n * 604800n;
  f.permanent = false;
  f.voted = false;
  f.escrowType = 0;
  f.vestingEnd = 0n;
  f.readContract.mockImplementation(async ({ address, functionName, args }) => {
    const pool = POOLS.find((p) => p.id === f.poolId)!;
    switch (functionName) {
      case "token":
        return address.toLowerCase() === ESCROW.toLowerCase()
          ? BTC_ASSET.address : LOCK_CONTRACTS.mezo.asset.address;
      case "token0":
        return pool.token0.address;
      case "token1":
        return pool.token1.address;
      case "stable":
        return pool.stable;
      case "factory":
      case "defaultFactory":
        return f.wrongFactory ? f.owner : FACTORY;
      case "getPool":
        return pool.address;
      case "getReserves":
        return f.empty
          ? [0n, 0n, f.time]
          : [10000n * unit, pool.stable ? 10000n * 10n ** 6n : unit, f.time];
      case "totalSupply":
        return f.empty ? 0n : 100n * unit;
      case "balanceOf":
        return f.balance;
      case "decimals":
        return address.toLowerCase() === pool.token1.address.toLowerCase()
          ? pool.token1.decimals
          : 18;
      case "getFee":
        return pool.stable ? 2n : 30n;
      case "isPaused":
        return false;
      case "allowance":
        return f.allowances.get(address.toLowerCase()) ?? 0n;
      case "quoteAddLiquidity":
        return [args[4], args[5], unit];
      case "quoteRemoveLiquidity":
        return [10n * unit, 10n ** 15n];
      case "getAmountsOut":
        return [
          args[0],
          args[1][0].to.toLowerCase() === pool.token0.address.toLowerCase()
            ? 10n * unit
            : 10n ** 15n,
        ];
      case "ownerOf":
        return f.holder;
      case "locked":
        return {
          amount: f.lockAmount,
          end: f.lockEnd,
          isPermanent: f.permanent,
          boost: 0n,
        };
      case "voted":
        return f.voted;
      case "escrowType":
        return f.escrowType;
      case "vestingEnd":
        return f.vestingEnd;
      default:
        throw new Error(`Unexpected method ${functionName}`);
    }
  });
  f.call.mockResolvedValue({
    data: encodeFunctionResult({
      abi: erc20Abi,
      functionName: "approve",
      result: true,
    }),
  });
  f.sendTransaction.mockImplementation(async (args) => {
    expect(readPendingWealth(f.owner)?.hash).toBeNull();
    f.getTransaction.mockResolvedValue({
      from: f.owner,
      to: args.to,
      input: args.data,
      value: args.value,
    });
    return hash;
  });
  f.waitForTransactionReceipt.mockResolvedValue({
    status: "success",
    transactionHash: hash,
  });
  f.getTransactionReceipt.mockResolvedValue({
    status: "success",
    transactionHash: hash,
  });
});

describe("exact quotes", () => {
  it("rejects silently rounded amounts, exponents and zero", () => {
    for (const value of ["1e3", "-1", "0", "1.0000001", ".5", "NaN"])
      expect(() => exactAmount(value, 6)).toThrow();
    expect(exactAmount("1.000001", 6)).toBe(1000001n);
    expect(minimumAmount(10000n, 50)).toBe(9950n);
    expect(() => minimumAmount(1n, 100)).toThrow();
  });
  it("binds protected liquidity amounts to the owner and a finite deadline", async () => {
    const plan = await quotePool(f.owner, "musd-btc", {
      kind: "add",
      amount0: "10",
      amount1: "0.001",
      slippageBps: 50,
    });
    const call = decodeFunctionData({ abi: ROUTER_ABI, data: plan.call.data });
    expect(call.functionName).toBe("addLiquidity");
    expect(call.args).toEqual([
      POOLS[0].token0.address,
      POOLS[0].token1.address,
      false,
      10n * unit,
      10n ** 15n,
      995n * 10n ** 16n,
      995n * 10n ** 12n,
      f.owner,
      f.time + 300n,
    ]);
    expect(plan.spends.every((spend) => spend.spender === ROUTER)).toBe(true);
  });
  it("quotes removal with two nonzero minimum returns", async () => {
    const plan = await quotePool(f.owner, "musd-btc", {
      kind: "remove",
      liquidity: "1",
      slippageBps: 100,
    });
    const call = decodeFunctionData({ abi: ROUTER_ABI, data: plan.call.data });
    expect(call.functionName).toBe("removeLiquidity");
    expect(call.args?.slice(-2)).toEqual([f.owner, f.time + 300n]);
    expect(plan.spends[0].asset.address).toBe(POOLS[0].address);
  });
  it("explains that the initial deposit sets the price", async () => {
    f.empty = true;
    const plan = await quotePool(f.owner, "musd-btc", {
      kind: "add",
      amount0: "1",
      amount1: "0.00001",
      slippageBps: 50,
    });
    expect(
      plan.details.some((item) => item.value.includes("starting price")),
    ).toBe(true);
  });
  it("fails closed for wrong router configuration and wrong RPC network", async () => {
    f.wrongFactory = true;
    await expect(readPool(f.owner, "musd-btc")).rejects.toThrow(
      "configuration",
    );
    f.wrongFactory = false;
    f.chain = 31612;
    await expect(readPool(f.owner, "musd-btc")).rejects.toThrow("testnet");
  });
});

describe("in-app swaps", () => {
  it("binds exact input, minimum output, verified route and recipient to the review", async () => {
    const plan = await quoteSwap(f.owner, "musd-btc", {
      amount: "10",
      reverse: false,
      slippageBps: 50,
    });
    const call = decodeFunctionData({ abi: ROUTER_ABI, data: plan.call.data });
    expect(call).toMatchObject({
      functionName: "swapExactTokensForTokens",
      args: [
        10n * unit,
        995n * 10n ** 12n,
        [
          {
            from: POOLS[0].token0.address,
            to: POOLS[0].token1.address,
            stable: false,
            factory: FACTORY,
          },
        ],
        f.owner,
        f.time + 300n,
      ],
    });
    expect(plan.spends).toEqual([
      { asset: POOLS[0].token0, amount: 10n * unit, spender: ROUTER },
    ]);
  });
  it("supports the reverse direction using the input token's decimals", async () => {
    f.poolId = "musd-usdc";
    const plan = await quoteSwap(f.owner, "musd-usdc", {
      amount: "1.25",
      reverse: true,
      slippageBps: 100,
    });
    expect(plan.spends[0]).toMatchObject({
      amount: 1250000n,
      asset: { symbol: "mUSDC" },
    });
    const call = decodeFunctionData({ abi: ROUTER_ABI, data: plan.call.data });
    expect(call.args?.[2]).toEqual([
      {
        from: getAddress(POOLS[1].token1.address),
        to: POOLS[1].token0.address,
        stable: true,
        factory: FACTORY,
      },
    ]);
  });
  it("refuses empty pairs and amounts above the wallet balance", async () => {
    f.empty = true;
    await expect(
      quoteSwap(f.owner, "musd-btc", {
        amount: "1",
        reverse: false,
        slippageBps: 50,
      }),
    ).rejects.toThrow("no liquidity");
    f.empty = false;
    f.balance = 0n;
    await expect(
      quoteSwap(f.owner, "musd-btc", {
        amount: "1",
        reverse: false,
        slippageBps: 50,
      }),
    ).rejects.toThrow("Not enough");
  });
});

describe("lock lifecycle", () => {
  it("stops quotes when an escrow upgrade changes the verified rules", async () => {
    f.upgraded = true;
    await expect(
      quoteLock(f.owner, { kind: "create", amount: "1", weeks: 4 }),
    ).rejects.toThrow("upgraded");
  });
  it("creates a finite user-owned lock with weekly rounding", async () => {
    const plan = await quoteLock(f.owner, {
      kind: "create",
      amount: "20",
      weeks: 4,
    });
    expect(
      decodeFunctionData({ abi: LOCK_ABI, data: plan.call.data }),
    ).toMatchObject({
      functionName: "createLock",
      args: [20n * unit, 4n * 604800n],
    });
    expect(plan.call.to).toBe(ESCROW);
    expect(plan.spends[0]).toMatchObject({ asset: BTC_ASSET, spender: ESCROW });
    expect(plan.call.value).toBe(0n);
    expect(roundedLockEnd(f.time, 4, MAX_LOCK_TIME).end % 604800n).toBe(0n);
    expect(() => roundedLockEnd(f.time, 209, MAX_LOCK_TIME)).toThrow();
    await expect(quoteLock(f.owner, { kind: "create", amount: "0.001", weeks: 5 })).rejects.toThrow("supported lock duration");
  });
  it("requires current ownership and refuses early withdrawals", async () => {
    await expect(
      quoteLock(f.owner, { kind: "withdraw", tokenId: "1" }),
    ).rejects.toThrow("unlock date");
    f.holder = "0x2222222222222222222222222222222222222222";
    await expect(
      quoteLock(f.owner, { kind: "increase", tokenId: "1", amount: "1" }),
    ).rejects.toThrow("owned");
  });
  it("keeps previous MEZO positions withdrawable without accepting new MEZO deposits", async () => {
    f.lockEnd = f.time;
    const previous = await quoteLock(f.owner, { kind: "withdraw", tokenId: "941" }, "mezo");
    expect(previous.call.to).toBe(LOCK_CONTRACTS.mezo.escrow);
    expect(previous.title).toBe("Withdraw MEZO");
    await expect(quoteLock(f.owner, { kind: "create", amount: "20", weeks: 4 }, "mezo")).rejects.toThrow("use BTC");
    await expect(quoteLock(f.owner, { kind: "increase", tokenId: "941", amount: "20" }, "mezo")).rejects.toThrow("use BTC");
  });
  it("reserves native BTC for fees as well as the ERC-20 precompile lock amount", async () => {
    const plan = await quoteLock(f.owner, { kind: "create", amount: "0.001", weeks: 4 });
    f.native = 10n ** 15n;
    await expect(prepareWealthStep(plan)).rejects.toThrow("Keep enough BTC");
    f.native += 1000000n;
    const step = await prepareWealthStep(plan);
    expect(step.call.to).toBe(BTC_ASSET.address);
    expect(decodeFunctionData({ abi: erc20Abi, data: step.call.data }).args).toEqual([ESCROW, 10n ** 15n]);
    expect(step.call.value).toBe(0n);
  });
  it("permits expired withdrawals but blocks assigned votes and managed positions", async () => {
    f.lockEnd = f.time;
    expect(
      (await quoteLock(f.owner, { kind: "withdraw", tokenId: "1" })).title,
    ).toBe("Withdraw BTC");
    f.voted = true;
    await expect(
      quoteLock(f.owner, { kind: "withdraw", tokenId: "1" }),
    ).rejects.toThrow("votes");
    f.voted = false;
    f.escrowType = 2;
    await expect(
      quoteLock(f.owner, { kind: "withdraw", tokenId: "1" }),
    ).rejects.toThrow("managed");
  });
  it("requires a later extension and does not add to unvested grants", async () => {
    await expect(
      quoteLock(f.owner, { kind: "extend", tokenId: "1", weeks: 2 }),
    ).rejects.toThrow("later");
    expect(
      (await quoteLock(f.owner, { kind: "extend", tokenId: "1", weeks: 4 }))
        .title,
    ).toBe("Extend lock");
    f.vestingEnd = f.time + 500n;
    await expect(
      quoteLock(f.owner, { kind: "increase", tokenId: "1", amount: "1" }),
    ).rejects.toThrow("unvested");
  });
  it("discloses a full countdown when ending permanent mode", async () => {
    f.permanent = true;
    f.lockEnd = 0n;
    const plan = await quoteLock(f.owner, {
      kind: "start-unlock",
      tokenId: "1",
    });
    expect(plan.title).toBe("Start BTC unlock");
    expect(plan.details.some(item => item.value.includes("up to 30 days"))).toBe(true);
    expect(
      plan.details.some((item) => item.value.includes("does not withdraw")),
    ).toBe(true);
  });
  it("invalidates a quote if the position or weekly boundary changes", async () => {
    const plan = await quoteLock(f.owner, {
      kind: "increase",
      tokenId: "1",
      amount: "1",
    });
    f.lockAmount++;
    await expect(plan.validate()).rejects.toThrow("changed");
    const create = await quoteLock(f.owner, {
      kind: "create",
      amount: "1",
      weeks: 4,
    });
    f.time += 604800n;
    await expect(create.validate()).rejects.toThrow("weekly");
  });
});

describe("wallet execution and recovery", () => {
  const plan = () =>
    quoteLock(f.owner, { kind: "create", amount: "20", weeks: 4 });
  it("does not return an unrelated pending transaction as the reviewed result", async () => {
    const step = await prepareWealthStep(await plan());
    storePendingWealth({
      requestId: "other",
      owner: f.owner,
      chainId: 31611,
      hash: null,
      kind: "action",
      title: "Other action",
      call: step.plan.call,
    });
    await expect(
      executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).rejects.toThrow("Another wallet action");
    expect(f.sendTransaction).not.toHaveBeenCalled();
  });
  it("does not clear a newer request while recovering an older one", async () => {
    const step = await prepareWealthStep(await plan());
    const old = {
      requestId: "old",
      owner: f.owner,
      chainId: 31611,
      hash,
      kind: step.kind,
      title: step.label,
      call: step.call,
    };
    storePendingWealth({ ...old, requestId: "new" });
    expect(clearPendingWealth(f.owner, old)).toBe(false);
    expect(readPendingWealth(f.owner)?.requestId).toBe("new");
  });
  it("honors a confirmed record cleared by another tab", async () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    });
    try {
      const step = await prepareWealthStep(await plan());
      storePendingWealth({
        requestId: "other-tab",
        owner: f.owner,
        chainId: 31611,
        hash,
        kind: step.kind,
        title: step.label,
        call: step.call,
      });
      expect(readPendingWealth(f.owner)?.hash).toBe(hash);
      entries.clear();
      expect(readPendingWealth(f.owner)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("sends only the reviewed exact approval, without automatically creating the lock", async () => {
    const step = await prepareWealthStep(await plan());
    expect(step.kind).toBe("approval");
    expect(
      decodeFunctionData({ abi: erc20Abi, data: step.call.data }).args,
    ).toEqual([ESCROW, 20n * unit]);
    expect(
      await executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).toMatchObject({ hash, kind: "approval", status: "confirmed" });
    expect(f.sendTransaction).toHaveBeenCalledTimes(1);
    expect(readPendingWealth(f.owner)).toBeNull();
  });
  it("uses an explicit zero-reset step for an insufficient nonzero allowance", async () => {
    f.allowances.set(BTC_ASSET.address.toLowerCase(), 1n);
    const step = await prepareWealthStep(await plan());
    expect(
      decodeFunctionData({ abi: erc20Abi, data: step.call.data }).args,
    ).toEqual([ESCROW, 0n]);
  });
  it("requires a fresh review after the approval step changes", async () => {
    const step = await prepareWealthStep(await plan());
    f.allowances.set(BTC_ASSET.address.toLowerCase(), 20n * unit);
    await expect(
      executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).rejects.toThrow("step changed");
    expect(f.sendTransaction).not.toHaveBeenCalled();
  });
  it("refuses expired quotes, switched accounts and insufficient BTC gas", async () => {
    const step = await prepareWealthStep(await plan());
    await expect(
      executeWealthStep(
        step,
        () => wallet,
        () => "another-wallet",
      ),
    ).rejects.toThrow("wallet changed");
    f.time += 301n;
    await expect(prepareWealthStep(step.plan)).rejects.toThrow("expired");
    f.time -= 301n;
    f.native = 0n;
    await expect(prepareWealthStep(step.plan)).rejects.toThrow("BTC");
    expect(f.sendTransaction).not.toHaveBeenCalled();
  });
  it("retains a broadcast through receipt timeout and recovers it without signing", async () => {
    const step = await prepareWealthStep(await plan());
    f.waitForTransactionReceipt.mockRejectedValue(new Error("timeout"));
    expect(
      await executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).toMatchObject({ status: "pending", hash });
    expect(readPendingWealth(f.owner)?.hash).toBe(hash);
    expect(await recoverWealth(f.owner)).toMatchObject({
      status: "confirmed",
      hash,
    });
    expect(f.sendTransaction).toHaveBeenCalledTimes(1);
  });
  it("keeps ambiguous provider failures reserved across retries", async () => {
    const step = await prepareWealthStep(await plan());
    f.sendTransaction.mockRejectedValue(new Error("provider timeout"));
    expect(
      await executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).toMatchObject({ status: "pending", hash: null });
    await executeWealthStep(
      step,
      () => wallet,
      () => f.owner,
    );
    expect(f.sendTransaction).toHaveBeenCalledTimes(1);
    expect(readPendingWealth(f.owner)).not.toBeNull();
  });
  it("releases a request explicitly rejected by the user", async () => {
    const step = await prepareWealthStep(await plan());
    f.sendTransaction.mockRejectedValue({ code: 4001 });
    await expect(
      executeWealthStep(
        step,
        () => wallet,
        () => f.owner,
      ),
    ).rejects.toThrow("cancelled");
    expect(readPendingWealth(f.owner)).toBeNull();
  });
  it("verifies sender and calldata when recovering a stored hash", async () => {
    const step = await prepareWealthStep(await plan());
    storePendingWealth({
      requestId: "fixture",
      owner: f.owner,
      chainId: 31611,
      hash,
      kind: step.kind,
      title: step.label,
      call: step.call,
    });
    f.getTransaction.mockResolvedValue({
      from: "0x2222222222222222222222222222222222222222",
      to: step.call.to,
      input: step.call.data,
      value: 0n,
    });
    await expect(recoverWealth(f.owner)).rejects.toThrow("does not match");
    expect(readPendingWealth(f.owner)?.hash).toBe(hash);
  });
});
