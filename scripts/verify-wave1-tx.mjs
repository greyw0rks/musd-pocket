import { createPublicClient, http, parseAbi, decodeFunctionData, parseEventLogs, erc20Abi, formatUnits, getAddress } from "viem";
import { writeFile } from "node:fs/promises";
const [operation, hash, walletInput] = process.argv.slice(2);
if (!["repay", "claimYield"].includes(operation) || !/^0x[\da-fA-F]{64}$/.test(hash || "") || !/^0x[\da-fA-F]{40}$/.test(walletInput || "")) throw new Error("Use repay|claimYield, a transaction hash, and a public wallet address.");
const wallet = getAddress(walletInput);
const rpc = createPublicClient({ transport: http("https://rpc.test.mezo.org", { timeout: 20_000, retryCount: 1 }) });
const token = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const vault = "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16";
const manager = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0";
const operations = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5";
const abi = parseAbi(["function repayMUSD(uint256,address,address)", "function claimYield() returns(uint256)", "function getTroveDebt(address) view returns(uint256)", "function getTroveColl(address) view returns(uint256)", "function balanceOf(address) view returns(uint256)", "function claimableYield(address) view returns(uint256)", "function yieldIndex() view returns(uint256)", "function supplyYieldIndex(address) view returns(uint256)"]);
const report = { operation, hash, wallet, chainId: 31611, executionVerified: false, stateVerified: false, explorer: `https://explorer.test.mezo.org/tx/${hash}` };
try {
  if (await rpc.getChainId() !== 31611) throw new Error("Wrong network");
  const [tx, receipt] = await Promise.all([rpc.getTransaction({ hash }), rpc.getTransactionReceipt({ hash })]);
  const call = decodeFunctionData({ abi, data: tx.input });
  const expectedFunction = operation === "repay" ? "repayMUSD" : "claimYield";
  const expectedContract = operation === "repay" ? operations : vault;
  if (tx.from.toLowerCase() !== wallet.toLowerCase() || tx.to?.toLowerCase() !== expectedContract.toLowerCase() || call.functionName !== expectedFunction || receipt.status !== "success" || tx.value !== 0n) throw new Error("Receipt does not prove the requested wallet operation");
  report.executionVerified = true; report.blockNumber = receipt.blockNumber.toString(); report.calledContract = expectedContract;
  const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter(log => log.address.toLowerCase() === token.toLowerCase()) });
  report.transfers = logs.map(log => ({ from: log.args.from, to: log.args.to, musd: formatUnits(log.args.value, 18) }));
  async function state(blockNumber) {
    const read = (address, functionName, args = []) => rpc.readContract({ address, abi, functionName, args, blockNumber });
    const [musd, principal, stored, index, userIndex, debt, collateral] = await Promise.all([
      read(token, "balanceOf", [wallet]), read(vault, "balanceOf", [wallet]), read(vault, "claimableYield", [wallet]), read(vault, "yieldIndex"), read(vault, "supplyYieldIndex", [wallet]), read(manager, "getTroveDebt", [wallet]), read(manager, "getTroveColl", [wallet]),
    ]);
    return { musd, principal, yield: stored + principal * (index - userIndex) / 10n ** 18n, debt, collateral };
  }
  try {
    const [before, after] = await Promise.all([state(receipt.blockNumber - 1n), state(receipt.blockNumber)]);
    report.before = Object.fromEntries(Object.entries(before).map(([key, value]) => [key, formatUnits(value, 18)]));
    report.after = Object.fromEntries(Object.entries(after).map(([key, value]) => [key, formatUnits(value, 18)]));
    report.stateVerified = operation === "repay" ? after.debt < before.debt && after.collateral === before.collateral && call.args[0] > 0n : after.principal === before.principal && logs.some(log => log.args.from.toLowerCase() === vault.toLowerCase() && log.args.to.toLowerCase() === wallet.toLowerCase() && log.args.value > 0n);
    report.historicalStateScope = "Block boundary snapshots may include other transactions in the same block.";
    if (!report.stateVerified) report.stateReason = "State changes did not establish the expected operation; review other transactions in the block.";
  } catch { report.stateReason = "Historical state could not be retrieved. Collect before/after snapshots around a fresh test."; }
  await writeFile(new URL(`../docs/evidence/${operation}-${hash.slice(2, 14)}.json`, import.meta.url), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.stateVerified) process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ failed: true, errorClass: error.name, summary: error.shortMessage || "Receipt verification failed" })); process.exitCode = 1; }
