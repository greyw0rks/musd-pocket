// Read-only contract configuration and unsigned quotes; never uses a wallet key.
import { writeFile } from "node:fs/promises";
import { formatUnits, type Address } from "viem";
import { POOLS } from "../lib/mezo/wealth/contracts";
import { readPool, quotePool } from "../lib/mezo/wealth/pools";
import { quoteSwap } from "../lib/mezo/wealth/swap";
import { readLockAccount, quoteLock } from "../lib/mezo/wealth/lock-actions";
import { prepareWealthStep } from "../lib/mezo/wealth/transactions";
import { getPublicClient } from "../lib/mezo/musd";

async function main() {
  const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as Address;
  const pools = [];
  for (const pool of POOLS) {
    const view = await readPool(owner, pool.id);
    const amount0 = 10n ** 18n;
    const amount1 =
      view.reserves[0] > 0n
        ? (amount0 * view.reserves[1]) / view.reserves[0]
        : pool.stable
          ? 10n ** BigInt(pool.token1.decimals)
          : 10n ** 13n;
    let quote = null;
    if (view.balance0 >= amount0 && view.balance1 >= amount1) {
      const plan = await quotePool(owner, pool.id, {
        kind: "add",
        amount0: "1",
        amount1: formatUnits(amount1, pool.token1.decimals),
        slippageBps: 50,
      });
      const step = await prepareWealthStep(plan);
      quote = {
        title: plan.title,
        details: plan.details,
        nextStep: step.label,
        estimatedFee: step.estimatedFee.toString(),
        calldata: plan.call.data,
        to: plan.call.to,
      };
    }
    const swap =
      view.totalSupply > 0n && view.balance0 >= amount0
        ? await quoteSwap(owner, pool.id, {
            amount: "1",
            reverse: false,
            slippageBps: 50,
          })
        : null;
    pools.push({
      id: pool.id,
      address: pool.address,
      block: view.blockNumber.toString(),
      token0: pool.token0,
      token1: pool.token1,
      reserves: view.reserves.map(String),
      lpBalance: view.lpBalance.toString(),
      feeBps: view.fee.toString(),
      paused: view.paused,
      quote,
      swap: swap
        ? { details: swap.details, calldata: swap.call.data, to: swap.call.to }
        : null,
    });
  }
  const lockAccount = await readLockAccount(owner);
  const lock = await quoteLock(owner, {
    kind: "create",
    amount: "1",
    weeks: 4,
  });
  const rpc = getPublicClient();
  const implementation = await rpc.getStorageAt({
    address: lock.call.to,
    slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  });
  const report = {
    capturedAt: new Date().toISOString(),
    chainId: 31611,
    owner,
    broadcasts: 0,
    pools,
    lock: {
      balance: lockAccount.balance.toString(),
      escrow: lock.call.to,
      implementation: implementation ? `0x${implementation.slice(-40)}` : null,
      details: lock.details,
      calldata: lock.call.data,
    },
  };
  await writeFile(
    "docs/evidence/inapp-wealth-readiness.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
});
