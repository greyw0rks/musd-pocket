// Verify the approved open/close around the independently checked repayment.
import { writeFile } from "node:fs/promises";
import { decodeEventLog, decodeFunctionData, erc20Abi, formatUnits, parseAbi, zeroAddress, type Hex } from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import { activeBorrow, CHAIN_ID, MUSD_ADDRESS } from "../lib/mezo/config";
import { TROVE_MANAGER_ABI } from "../lib/mezo/borrow";
import { BORROWER_OPERATIONS_ABI } from "../lib/mezo/borrow-write";

async function main() {
  const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as const;
  const openHash = "0xa6f7cdd5570fd32f2ead694375072f30bdd26a4623e5b31df29337a31876b752" as const;
  const closeHash = "0xa5cc358a589f8966b76c20d6d2881e765e50d25eeec2da2723406d4ec8ed93f6" as const;
  const rpc = getPublicClient();
  if (CHAIN_ID !== 31611 || await rpc.getChainId() !== 31611) throw new Error("Mezo testnet only.");
  const readAbi = parseAbi(["function activePool() view returns(address)"]);
  const collateralAbi = parseAbi(["event CollateralSent(address _to,uint256 _amount)"]);
  async function transaction(hash: Hex) {
    // Mezo RPC sometimes omits a known mined receipt on an individual read.
    const receipt = await rpc.waitForTransactionReceipt({ hash, timeout: 60_000, pollingInterval: 1_000 });
    if (receipt.status !== "success" || receipt.from.toLowerCase() !== owner || receipt.to?.toLowerCase() !== activeBorrow.borrowerOperations.toLowerCase()) throw new Error("Wrong borrower/target or failed receipt.");
    let input: Hex, value: bigint;
    try { const tx = await rpc.getTransaction({ hash }); input = tx.input; value = tx.value; }
    catch {
      const response = await fetch(`https://api.explorer.test.mezo.org/api/v2/transactions/${hash}`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Transaction data unavailable.");
      const tx = await response.json();
      if (tx.hash?.toLowerCase() !== hash || tx.status !== "ok" || BigInt(tx.block_number) !== receipt.blockNumber || tx.from.hash.toLowerCase() !== owner || tx.to.hash.toLowerCase() !== activeBorrow.borrowerOperations.toLowerCase()) throw new Error("Explorer data does not match the receipt.");
      input = tx.raw_input; value = BigInt(tx.value);
    }
    return { receipt, call: decodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, data: input }), value };
  }
  async function state(blockNumber: bigint) {
    const [status, debt, collateral, balance] = await Promise.all([
      rpc.readContract({ address: activeBorrow.troveManager, abi: TROVE_MANAGER_ABI, functionName: "getTroveStatus", args: [owner], blockNumber }),
      rpc.readContract({ address: activeBorrow.troveManager, abi: TROVE_MANAGER_ABI, functionName: "getTroveDebt", args: [owner], blockNumber }),
      rpc.readContract({ address: activeBorrow.troveManager, abi: TROVE_MANAGER_ABI, functionName: "getTroveColl", args: [owner], blockNumber }),
      rpc.readContract({ address: MUSD_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [owner], blockNumber }),
    ]);
    return { status, debt, collateral, balance };
  }
  function tokenChange(receipt: Awaited<ReturnType<typeof transaction>>["receipt"], direction: "mint" | "burn") {
    let amount = 0n;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== MUSD_ADDRESS.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics });
        if (direction === "mint" ? event.args.from === zeroAddress && event.args.to.toLowerCase() === owner : event.args.from.toLowerCase() === owner && event.args.to === zeroAddress) amount += event.args.value;
      } catch { /* Other token events. */ }
    }
    return amount;
  }
  const [open, close] = await Promise.all([transaction(openHash), transaction(closeHash)]);
  if (open.call.functionName !== "openTrove" || open.call.args[0] !== 2_000n * 10n ** 18n || open.value !== 50_000_000_000_000_000n || close.call.functionName !== "closeTrove") throw new Error("Calls differ from the approved sequence.");
  const [beforeOpen, afterOpen, beforeClose, afterClose, activePool] = await Promise.all([
    state(open.receipt.blockNumber - 1n), state(open.receipt.blockNumber), state(close.receipt.blockNumber - 1n), state(close.receipt.blockNumber),
    rpc.readContract({ address: activeBorrow.borrowerOperations, abi: readAbi, functionName: "activePool", blockNumber: close.receipt.blockNumber }),
  ]);
  let collateralReturned = 0n;
  for (const log of close.receipt.logs) {
    if (log.address.toLowerCase() !== activePool.toLowerCase()) continue;
    try { const event = decodeEventLog({ abi: collateralAbi, eventName: "CollateralSent", data: log.data, topics: log.topics }); if (event.args._to.toLowerCase() === owner) collateralReturned += event.args._amount; } catch {}
  }
  const minted = tokenChange(open.receipt, "mint"), burned = tokenChange(close.receipt, "burn");
  const passed = beforeOpen.status !== 1 && afterOpen.status === 1 && afterOpen.collateral === open.value
    && minted === 2_000n * 10n ** 18n && afterOpen.balance - beforeOpen.balance === minted
    && beforeClose.status === 1 && afterClose.status === 2 && afterClose.debt === 0n && afterClose.collateral === 0n
    && collateralReturned === 50_000_000_000_000_000n && beforeClose.balance - afterClose.balance === burned;
  const format = (s: typeof beforeOpen) => ({ status: s.status, debtMusd: formatUnits(s.debt, 18), collateralBtc: formatUnits(s.collateral, 18), walletMusd: formatUnits(s.balance, 18) });
  const report = { capturedAt: new Date().toISOString(), chainId: 31611, owner, open: { hash: openHash, block: String(open.receipt.blockNumber), status: open.receipt.status, mintedMusd: formatUnits(minted, 18), collateralBtc: formatUnits(open.value, 18), before: format(beforeOpen), after: format(afterOpen) }, close: { hash: closeHash, block: String(close.receipt.blockNumber), status: close.receipt.status, burnedMusd: formatUnits(burned, 18), collateralReturnedBtc: formatUnits(collateralReturned, 18), activePool, before: format(beforeClose), after: format(afterClose) }, passed, broadcasts: 0 };
  await writeFile("docs/evidence/wave-2-borrow-lifecycle.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}
main().catch(error => { console.error(error.shortMessage ?? error.message); process.exitCode = 1; });
