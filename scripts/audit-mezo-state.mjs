import { createPublicClient, http, parseAbi, formatUnits, formatEther } from "viem";
import { mezoTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { writeFile } from "node:fs/promises";

const wallet = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
const musd = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const vault = "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16";
const trove = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0";
const operations = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5";
const mezo = "0x7B7c000000000000000000000000000000000001";
const escrow = "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b";
const rpc = createPublicClient({ chain: mezoTestnet, transport: http(process.env.NEXT_PUBLIC_MEZO_RPC_URL || "https://rpc.test.mezo.org") });
const block = await rpc.getBlock();
const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)", "function claimableYield(address) view returns (uint256)",
  "function yieldIndex() view returns (uint256)", "function supplyYieldIndex(address) view returns (uint256)",
  "function getTroveStatus(address) view returns (uint256)", "function getTroveDebt(address) view returns (uint256)",
  "function getTroveColl(address) view returns (uint256)", "function minNetDebt() view returns (uint256)",
  "function token() view returns (address)", "function claimYield() returns (uint256)",
  "function repayMUSD(uint256,address,address)",
]);
const read = (address, functionName, args = []) => rpc.readContract({ address, abi, functionName, args, blockNumber: block.number });
const key = process.env.RELAYER_PRIVATE_KEY;
const relayer = key ? privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`).address : null;
const [shares, storedYield, globalIndex, userIndex, status, debt, collateral, minimum, musdBalance, btc, escrowToken, rewardInventory] = await Promise.all([
  read(vault, "balanceOf", [wallet]), read(vault, "claimableYield", [wallet]), read(vault, "yieldIndex"), read(vault, "supplyYieldIndex", [wallet]),
  read(trove, "getTroveStatus", [wallet]), read(trove, "getTroveDebt", [wallet]), read(trove, "getTroveColl", [wallet]),
  read(operations, "minNetDebt"), read(musd, "balanceOf", [wallet]), rpc.getBalance({ address: wallet, blockNumber: block.number }),
  read(escrow, "token"), relayer ? read(mezo, "balanceOf", [relayer]) : 0n,
]);
const claimable = storedYield + shares * (globalIndex - userIndex) / 10n ** 18n;
const maxRepayment = debt > minimum + 200n * 10n ** 18n ? debt - minimum - 200n * 10n ** 18n : 0n;
const simulate = async (address, functionName, args) => {
  try { const result = await rpc.simulateContract({ address, abi, functionName, args, account: wallet }); return { accepted: true, result: result.result?.toString() ?? null }; }
  catch { return { accepted: false }; }
};
const amount = maxRepayment >= 10n ** 18n && musdBalance >= 10n ** 18n ? 10n ** 18n : 0n;
const [claimSimulation, repaySimulation] = await Promise.all([
  claimable > 0n ? simulate(vault, "claimYield", []) : null,
  status === 1n && amount > 0n ? simulate(operations, "repayMUSD", [amount, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"]) : null,
]);
const report = {
  chainId: await rpc.getChainId(), blockNumber: block.number.toString(), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(), wallet,
  savings: { vault, principal: formatUnits(shares, 18), storedYield: formatUnits(storedYield, 18), claimableYield: formatUnits(claimable, 18), claimSimulation },
  borrow: { status: status.toString(), debt: formatUnits(debt, 18), collateralBtc: formatEther(collateral), maxRepayment: formatUnits(maxRepayment, 18), proposedRepayment: formatUnits(amount, 18), repaySimulation },
  walletBalances: { btc: formatEther(btc), musd: formatUnits(musdBalance, 18) },
  welcome: { token: mezo, escrow, escrowToken, relayer, availableMezo: formatUnits(rewardInventory, 18) },
  liveExecution: { repay: "pending user signature", claimYield: "pending user signature" },
};
await writeFile(new URL("../docs/evidence/mezo-wallet-state.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
