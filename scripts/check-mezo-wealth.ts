// Read-only readiness report. No signer, broadcasts, or database writes.
import { writeFile } from "node:fs/promises";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  parseAbi,
  type Address,
} from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import { CHAIN_ID, MUSD_ADDRESS, activeBorrow } from "../lib/mezo/config";
import {
  activeEarn,
  readClaimableYield,
  SAVINGS_VAULT_ABI,
} from "../lib/mezo/earn";
import { TROVE_MANAGER_ABI, TROVE_STATUS } from "../lib/mezo/borrow";
import {
  MEZO_REWARD_TOKEN,
  TESTNET_VEMEZO,
  WELCOME_ESCROW_ABI,
} from "../lib/rewards/abi";

async function main() {
  const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as Address;
  const rpc = getPublicClient();
  if (CHAIN_ID !== 31611 || (await rpc.getChainId()) !== 31611)
    throw new Error("Testnet only");
  const block = await rpc.getBlock();
  const blockNumber = block.number;
  const [
    btc,
    musd,
    stored,
    accrued,
    principal,
    status,
    debt,
    escrowToken,
    mezoDecimals,
  ] = await Promise.all([
    rpc.getBalance({ address: owner, blockNumber }),
    rpc.readContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: activeEarn.savingsVault,
      abi: SAVINGS_VAULT_ABI,
      functionName: "claimableYield",
      args: [owner],
      blockNumber,
    }),
    readClaimableYield(owner, blockNumber),
    rpc.readContract({
      address: activeEarn.savingsVault,
      abi: SAVINGS_VAULT_ABI,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: activeBorrow.troveManager,
      abi: TROVE_MANAGER_ABI,
      functionName: "getTroveStatus",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: activeBorrow.troveManager,
      abi: TROVE_MANAGER_ABI,
      functionName: "getTroveDebt",
      args: [owner],
      blockNumber,
    }),
    rpc.readContract({
      address: TESTNET_VEMEZO,
      abi: WELCOME_ESCROW_ABI,
      functionName: "token",
      blockNumber,
    }),
    rpc.readContract({
      address: MEZO_REWARD_TOKEN,
      abi: erc20Abi,
      functionName: "decimals",
      blockNumber,
    }),
  ]);
  const claim = {
    account: owner,
    address: activeEarn.savingsVault,
    abi: SAVINGS_VAULT_ABI,
    functionName: "claimYield" as const,
  };
  const [simulation, gas, gasPrice] = await Promise.all([
    rpc.simulateContract({ ...claim, blockNumber }),
    rpc.estimateContractGas(claim),
    rpc.getGasPrice(),
  ]);
  const poolAbi = parseAbi([
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function stable() view returns (bool)",
  ]);
  const pools = await Promise.all(
    (
      [
        "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
        "0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e",
        "0x27414B76CF00E24ed087adb56E26bAeEEe93494e",
      ] as Address[]
    ).map(async (address) => {
      const [token0, token1, stable] = await Promise.all([
        rpc.readContract({
          address,
          abi: poolAbi,
          functionName: "token0",
          blockNumber,
        }),
        rpc.readContract({
          address,
          abi: poolAbi,
          functionName: "token1",
          blockNumber,
        }),
        rpc.readContract({
          address,
          abi: poolAbi,
          functionName: "stable",
          blockNumber,
        }),
      ]);
      const symbols = await Promise.all(
        [token0, token1].map((token) =>
          rpc.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
            blockNumber,
          }),
        ),
      );
      return { address, token0, token1, symbols, stable };
    }),
  );
  const report = {
    capturedAt: new Date().toISOString(),
    chainId: CHAIN_ID,
    block: blockNumber.toString(),
    owner,
    wallet: { btc: formatEther(btc), musd: formatUnits(musd, 18) },
    savings: {
      vault: activeEarn.savingsVault,
      principal: formatUnits(principal, 18),
      stored: formatUnits(stored, 18),
      accrued: formatUnits(accrued, 18),
      simulatedPayout: formatUnits(simulation.result, 18),
      estimatedGas: gas.toString(),
      gasPriceWei: gasPrice.toString(),
      estimatedBtcFee: formatEther(gas * gasPrice),
      calldata: "0x406cf229",
      value: "0",
      receipt: null,
    },
    borrow: {
      status: TROVE_STATUS[status as keyof typeof TROVE_STATUS],
      debt: formatUnits(debt, 18),
      partialRepaymentReady: status === 1,
      receipt: null,
    },
    rewards: {
      escrow: TESTNET_VEMEZO,
      token: escrowToken,
      decimals: mezoDecimals,
      campaignDeployedByThisTask: false,
    },
    pools,
  };
  await writeFile(
    "docs/evidence/mezo-wealth-readiness.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
});
