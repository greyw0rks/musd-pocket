import { toFunctionSelector } from "viem";
import { writeFile } from "node:fs/promises";
const wallet = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
const operations = "0xcdf7028ceab81fa0c6971208e83fa7872994bee5";
const savings = "0x6f461c68b2c5492c0f5ccec5a264d692aa7a8e16";
let params = new URLSearchParams();
const matches = []; let scanned = 0;
try {
  for (let page = 0; page < 5; page++) {
    const response = await fetch(`https://api.explorer.test.mezo.org/api/v2/addresses/${wallet}/transactions?${params}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Explorer unavailable");
    const body = await response.json();
    for (const tx of body.items ?? []) {
      scanned++;
      if (tx.from?.hash?.toLowerCase() !== wallet) continue;
      const recipient = tx.to?.hash?.toLowerCase();
      const input = (tx.raw_input ?? "").slice(0, 10);
      const method = (tx.method ?? "").toLowerCase();
      const operation = recipient === operations && (input === toFunctionSelector("repayMUSD(uint256,address,address)") || method === "repaymusd") ? "repay" : recipient === savings && (input === toFunctionSelector("claimYield()") || method === "claimyield") ? "claimYield" : null;
      if (operation) matches.push({ operation, hash: tx.hash, status: tx.status, timestamp: tx.timestamp, blockNumber: tx.block_number });
    }
    if (!body.next_page_params) break;
    params = new URLSearchParams(Object.entries(body.next_page_params).filter(([,value]) => value != null).map(([key,value]) => [key, String(value)]));
  }
  const report = { wallet, chainId: 31611, scanned, matches, source: "Public Mezo explorer; receipt and state verification still required for matches." };
  await writeFile(new URL("../docs/evidence/wave1-wallet-history.json", import.meta.url), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} catch (error) { console.error(JSON.stringify({ failed: true, errorClass: error.name })); process.exitCode=1; }
