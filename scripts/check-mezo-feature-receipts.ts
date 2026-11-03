// Verify indexed outgoing feature transactions against RPC receipts. Never signs.
import { writeFile } from "node:fs/promises";
import {
  decodeEventLog,
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  type Hex,
} from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import {
  CHAIN_ID,
  MUSD_ADDRESS,
  EXPLORER_URL,
  activeBorrow,
} from "../lib/mezo/config";
import { activeEarn } from "../lib/mezo/earn";
import { BORROWER_OPERATIONS_ABI } from "../lib/mezo/borrow-write";

async function main() {
  const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
  const rpc = getPublicClient();
  if (CHAIN_ID !== 31611 || (await rpc.getChainId()) !== CHAIN_ID)
    throw new Error("Testnet only");
  let url: string | null =
    `https://api.explorer.test.mezo.org/api/v2/addresses/${owner}/transactions?filter=from`;
  const matches = [];
  let inspected = 0;
  for (let page = 0; url && page < 5; page++) {
    const response: Response = await fetch(url);
    if (!response.ok) throw new Error(`Explorer HTTP ${response.status}`);
    const data: {
      items: { raw_input: string; hash: Hex }[];
      next_page_params: Record<string, string> | null;
    } = await response.json();
    for (const item of data.items) {
      inspected++;
      const selector = String(item.raw_input).slice(0, 10);
      if (!["0x406cf229", "0xdc283bb3"].includes(selector)) continue;
      const hash = item.hash as Hex;
      const [tx, receipt] = await Promise.all([
        rpc.getTransaction({ hash }),
        rpc.getTransactionReceipt({ hash }),
      ]);
      const target =
        selector === "0x406cf229"
          ? activeEarn.savingsVault
          : activeBorrow.borrowerOperations;
      if (
        tx.from.toLowerCase() !== owner ||
        tx.to?.toLowerCase() !== target.toLowerCase() ||
        receipt.status !== "success"
      )
        continue;
      let amount = 0n;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== MUSD_ADDRESS.toLowerCase()) continue;
        try {
          const event = decodeEventLog({
            abi: erc20Abi,
            eventName: "Transfer",
            data: log.data,
            topics: log.topics,
          });
          if (
            event.args.to.toLowerCase() === owner &&
            event.args.from.toLowerCase() ===
              activeEarn.savingsVault.toLowerCase()
          )
            amount += event.args.value;
        } catch {
          /* Other mUSD events are not claim payouts. */
        }
      }
      const decoded =
        selector === "0xdc283bb3"
          ? decodeFunctionData({ abi: BORROWER_OPERATIONS_ABI, data: tx.input })
          : null;
      const requestedRepay =
        decoded?.functionName === "repayMUSD"
          ? formatUnits(decoded.args[0], 18)
          : null;
      matches.push({
        kind: selector === "0x406cf229" ? "claimYield" : "repayMUSD",
        hash,
        block: receipt.blockNumber.toString(),
        status: receipt.status,
        musdReceived: formatUnits(amount, 18),
        requestedRepay,
        explorer: `${EXPLORER_URL}/tx/${hash}`,
      });
    }
    url = data.next_page_params
      ? `https://api.explorer.test.mezo.org/api/v2/addresses/${owner}/transactions?${new URLSearchParams({ ...data.next_page_params, filter: "from" })}`
      : null;
  }
  const report = {
    capturedAt: new Date().toISOString(),
    chainId: CHAIN_ID,
    owner,
    inspected,
    complete: url === null,
    broadcastsByThisScript: 0,
    matches,
  };
  await writeFile(
    "docs/evidence/mezo-feature-receipts.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
});
