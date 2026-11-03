import { encodeFunctionData, formatUnits, type Address } from "viem";
import { CHAIN_ID } from "../config";
import { getPublicClient } from "../musd";
import { FACTORY, ROUTER, ROUTER_ABI, type PoolId } from "./contracts";
import { exactAmount, minimumAmount } from "./math";
import { readPool } from "./pools";
import type { WealthPlan } from "./types";

export type SwapIntent = {
  amount: string;
  reverse: boolean;
  slippageBps: number;
};

/** A single verified pool, exact input, protected output, and wallet recipient. */
export async function quoteSwap(
  owner: Address,
  id: PoolId,
  intent: SwapIntent,
): Promise<WealthPlan> {
  const view = await readPool(owner, id);
  if (view.paused) throw new Error("Swaps are paused. Try again later.");
  if (
    view.totalSupply === 0n ||
    view.reserves[0] === 0n ||
    view.reserves[1] === 0n
  )
    throw new Error("This pair has no liquidity yet. Choose another pair.");
  const input = intent.reverse ? view.pool.token1 : view.pool.token0;
  const output = intent.reverse ? view.pool.token0 : view.pool.token1;
  const amountIn = exactAmount(intent.amount, input.decimals);
  const balance = intent.reverse ? view.balance1 : view.balance0;
  if (amountIn > balance)
    throw new Error(`Not enough ${input.symbol} in your wallet.`);
  const routes = [
    {
      from: input.address,
      to: output.address,
      stable: view.pool.stable,
      factory: FACTORY,
    },
  ];
  const amounts = await getPublicClient().readContract({
    address: ROUTER,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountIn, routes],
    blockNumber: view.blockNumber,
  });
  if (amounts.length !== 2 || amounts[0] !== amountIn || amounts[1] <= 0n)
    throw new Error("No usable swap quote is available.");
  const minOut = minimumAmount(amounts[1], intent.slippageBps);
  const deadline = view.timestamp + 300n;
  return {
    owner,
    chainId: CHAIN_ID,
    title: `Swap ${input.symbol} for ${output.symbol}`,
    expiresAt: Number(deadline),
    spends: [{ asset: input, amount: amountIn, spender: ROUTER }],
    details: [
      {
        label: "You pay",
        value: `${formatUnits(amountIn, input.decimals)} ${input.symbol}`,
      },
      {
        label: "Estimated received",
        value: `${formatUnits(amounts[1], output.decimals)} ${output.symbol}`,
      },
      {
        label: "Minimum received",
        value: `${formatUnits(minOut, output.decimals)} ${output.symbol}`,
      },
      { label: "Pool fee (included)", value: `${formatUnits(view.fee, 2)}%` },
      { label: "Slippage tolerance", value: `${intent.slippageBps / 100}%` },
      {
        label: "Quote expires",
        value: new Date(Number(deadline) * 1000).toISOString(),
      },
      { label: "Owner and recipient", value: owner },
    ],
    call: {
      to: ROUTER,
      value: 0n,
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, minOut, routes, owner, deadline],
      }),
    },
    validate: async () => {
      const fresh = await readPool(owner, id);
      if (fresh.paused || fresh.reserves[0] === 0n || fresh.reserves[1] === 0n)
        throw new Error("This pair is unavailable. Review another pair.");
    },
  };
}
