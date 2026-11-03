import { encodeFunctionData, erc20Abi, formatUnits, type Address } from "viem";
import { getPublicClient } from "../musd";
import { CHAIN_ID } from "../config";
import {
  FACTORY,
  FACTORY_ABI,
  POOL_ABI,
  ROUTER,
  ROUTER_ABI,
  poolById,
  type PoolId,
} from "./contracts";
import { assertWealthNetwork } from "./transactions";
import { exactAmount, minimumAmount } from "./math";
import type { Asset, WealthPlan } from "./types";

export async function readPool(owner: Address, id: PoolId) {
  await assertWealthNetwork();
  const pool = poolById(id);
  const rpc = getPublicClient();
  const block = await rpc.getBlock();
  const blockNumber = block.number;
  const [
    token0,
    token1,
    stable,
    factory,
    defaultFactory,
    registered,
    reserves,
    totalSupply,
    lpBalance,
    balance0,
    balance1,
    decimals0,
    decimals1,
    lpDecimals,
    fee,
    paused,
  ] = await Promise.all([
    rpc.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "token0",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "token1",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "stable",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "factory",
      blockNumber,
    }),
    rpc.readContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: "defaultFactory",
      blockNumber,
    }),
    rpc.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [pool.token0.address, pool.token1.address, pool.stable],
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "getReserves",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: erc20Abi,
      functionName: "totalSupply",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: pool.token0.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: pool.token1.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: pool.token0.address,
      abi: erc20Abi,
      functionName: "decimals",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.token1.address,
      abi: erc20Abi,
      functionName: "decimals",
      blockNumber,
    }),
    rpc.readContract({
      address: pool.address,
      abi: erc20Abi,
      functionName: "decimals",
      blockNumber,
    }),
    rpc.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "getFee",
      args: [pool.address, pool.stable],
      blockNumber,
    }),
    rpc.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "isPaused",
      blockNumber,
    }),
  ]);
  const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (
    !equal(token0, pool.token0.address) ||
    !equal(token1, pool.token1.address) ||
    stable !== pool.stable ||
    !equal(factory, FACTORY) ||
    !equal(defaultFactory, FACTORY) ||
    !equal(registered, pool.address) ||
    decimals0 !== pool.token0.decimals ||
    decimals1 !== pool.token1.decimals ||
    lpDecimals !== 18
  )
    throw new Error(
      "The pool's token or router configuration changed. Trading is unavailable.",
    );
  // claimFees updates the holder's indices, so a simulation includes unrecorded fees.
  const fees = await rpc
    .simulateContract({
      account: owner,
      address: pool.address,
      abi: POOL_ABI,
      functionName: "claimFees",
      blockNumber,
    })
    .then((result) => result.result)
    .catch(() => null);
  return {
    pool,
    blockNumber,
    timestamp: block.timestamp,
    reserves,
    totalSupply,
    lpBalance,
    balance0,
    balance1,
    fee,
    paused,
    fees,
    position0: totalSupply > 0n ? (reserves[0] * lpBalance) / totalSupply : 0n,
    position1: totalSupply > 0n ? (reserves[1] * lpBalance) / totalSupply : 0n,
  };
}
export type PoolView = Awaited<ReturnType<typeof readPool>>;
export type PoolIntent =
  | { kind: "add"; amount0: string; amount1: string; slippageBps: number }
  | { kind: "remove"; liquidity: string; slippageBps: number }
  | { kind: "fees" };

export async function quotePool(
  owner: Address,
  id: PoolId,
  intent: PoolIntent,
): Promise<WealthPlan> {
  const view = await readPool(owner, id);
  const { pool, blockNumber, timestamp } = view;
  const rpc = getPublicClient();
  const deadline = timestamp + 300n;
  let title: string;
  let data: `0x${string}`;
  let to: Address = ROUTER;
  const spends: WealthPlan["spends"] = [];
  const details: WealthPlan["details"] = [
    { label: "Pool", value: `${pool.token0.symbol} / ${pool.token1.symbol}` },
  ];
  const amountLabel = (amount: bigint, token: Asset) =>
    `${formatUnits(amount, token.decimals)} ${token.symbol}`;
  if (intent.kind === "add") {
    if (view.paused)
      throw new Error("The pool factory is paused. Try again later.");
    const amount0 = exactAmount(intent.amount0, pool.token0.decimals);
    const amount1 = exactAmount(intent.amount1, pool.token1.decimals);
    if (view.totalSupply === 0n && pool.stable) {
      const x = (amount0 * 10n ** 18n) / 10n ** BigInt(pool.token0.decimals);
      const y = (amount1 * 10n ** 18n) / 10n ** BigInt(pool.token1.decimals);
      if (x !== y)
        throw new Error(
          "The first stable-pool deposit requires equal token amounts after decimal conversion.",
        );
      const k =
        (((x * y) / 10n ** 18n) *
          ((x * x) / 10n ** 18n + (y * y) / 10n ** 18n)) /
        10n ** 18n;
      if (k <= 10n ** 10n)
        throw new Error("This first stable-pool deposit is too small.");
    }
    if (view.totalSupply === 0n)
      details.push({
        label: "First liquidity deposit",
        value: `You set the starting price: 1 ${pool.token1.symbol} = ${formatUnits((amount0 * 10n ** BigInt(pool.token1.decimals)) / amount1, pool.token0.decimals)} ${pool.token0.symbol}.`,
      });
    if (amount0 > view.balance0 || amount1 > view.balance1)
      throw new Error("The deposit exceeds your wallet balance.");
    const [used0, used1, minted] = await rpc.readContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: "quoteAddLiquidity",
      args: [
        pool.token0.address,
        pool.token1.address,
        pool.stable,
        FACTORY,
        amount0,
        amount1,
      ],
      blockNumber,
    });
    if (minted <= 0n || used0 > amount0 || used1 > amount1)
      throw new Error("No usable liquidity quote is available.");
    const min0 = minimumAmount(used0, intent.slippageBps);
    const min1 = minimumAmount(used1, intent.slippageBps);
    title = "Add liquidity";
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "addLiquidity",
      args: [
        pool.token0.address,
        pool.token1.address,
        pool.stable,
        amount0,
        amount1,
        min0,
        min1,
        owner,
        deadline,
      ],
    });
    spends.push(
      { asset: pool.token0, spender: ROUTER, amount: amount0 },
      { asset: pool.token1, spender: ROUTER, amount: amount1 },
    );
    details.push(
      {
        label: "Maximum deposit",
        value: `${amountLabel(amount0, pool.token0)} + ${amountLabel(amount1, pool.token1)}`,
      },
      {
        label: "Estimated deposit",
        value: `${amountLabel(used0, pool.token0)} + ${amountLabel(used1, pool.token1)}`,
      },
      {
        label: "Minimum amounts added",
        value: `${amountLabel(min0, pool.token0)} + ${amountLabel(min1, pool.token1)}`,
      },
      { label: "Estimated LP tokens", value: formatUnits(minted, 18) },
      { label: "Unused tokens", value: "Stay in your wallet" },
    );
  } else if (intent.kind === "remove") {
    const liquidity = exactAmount(intent.liquidity, 18);
    if (liquidity > view.lpBalance)
      throw new Error("Choose no more than the LP tokens in your wallet.");
    const [amount0, amount1] = await rpc.readContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: "quoteRemoveLiquidity",
      args: [
        pool.token0.address,
        pool.token1.address,
        pool.stable,
        FACTORY,
        liquidity,
      ],
      blockNumber,
    });
    const min0 = minimumAmount(amount0, intent.slippageBps);
    const min1 = minimumAmount(amount1, intent.slippageBps);
    title = "Remove liquidity";
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "removeLiquidity",
      args: [
        pool.token0.address,
        pool.token1.address,
        pool.stable,
        liquidity,
        min0,
        min1,
        owner,
        deadline,
      ],
    });
    spends.push({
      asset: { address: pool.address, symbol: "LP", decimals: 18 },
      spender: ROUTER,
      amount: liquidity,
    });
    details.push(
      { label: "LP tokens removed", value: formatUnits(liquidity, 18) },
      {
        label: "Estimated return",
        value: `${amountLabel(amount0, pool.token0)} + ${amountLabel(amount1, pool.token1)}`,
      },
      {
        label: "Minimum returned",
        value: `${amountLabel(min0, pool.token0)} + ${amountLabel(min1, pool.token1)}`,
      },
    );
  } else {
    if (!view.fees) throw new Error("Could not read your claimable pool fees.");
    if (view.fees[0] === 0n && view.fees[1] === 0n)
      throw new Error("No pool fees are claimable yet.");
    title = "Claim pool fees";
    to = pool.address;
    data = encodeFunctionData({ abi: POOL_ABI, functionName: "claimFees" });
    details.push({
      label: "Estimated fees received",
      value: `${amountLabel(view.fees[0], pool.token0)} + ${amountLabel(view.fees[1], pool.token1)}`,
    });
  }
  if ("slippageBps" in intent)
    details.push({
      label: "Slippage tolerance",
      value: `${intent.slippageBps / 100}%`,
    });
  details.push({ label: "Owner and recipient", value: owner });
  return {
    owner,
    chainId: CHAIN_ID,
    title,
    expiresAt: Number(deadline),
    spends,
    details,
    call: { to, data, value: 0n },
    validate: async () => {
      const fresh = await readPool(owner, id);
      if (intent.kind === "add" && fresh.paused)
        throw new Error("The pool factory is paused.");
      if (
        intent.kind === "fees" &&
        (!fresh.fees || fresh.fees.every((amount) => amount === 0n))
      )
        throw new Error("No fees are currently claimable.");
    },
  };
}
