// Read-only Mezo Testnet configuration and ownership checks. No wallet or key.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { erc20Abi } from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import { readMezoLocks } from "../lib/mezo/locks";
import { readLockAccount } from "../lib/mezo/wealth/lock-actions";
import { BTC_ASSET, LOCK_ABI, LOCK_CONTRACTS, LOCK_MAX_TIME_SLOT } from "../lib/mezo/wealth/contracts";

async function main() {
const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
const rpc = getPublicClient();
const blockNumber = await rpc.getBlockNumber();
const chainId = await rpc.getChainId();
assert.equal(chainId, 31611);
const positions = [];
for (const asset of ["btc", "mezo"] as const) {
  const config = LOCK_CONTRACTS[asset];
  await readLockAccount(owner, asset);
  const [token, implementation, duration, locks] = await Promise.all([
    rpc.readContract({ address: config.escrow, abi: LOCK_ABI, functionName: "token", blockNumber }),
    rpc.getStorageAt({ address: config.escrow, slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", blockNumber }),
    rpc.getStorageAt({ address: config.escrow, slot: LOCK_MAX_TIME_SLOT, blockNumber }),
    readMezoLocks(owner, 0, asset),
  ]);
  assert.equal(token.toLowerCase(), config.asset.address.toLowerCase());
  assert.equal(implementation?.slice(-40).toLowerCase(), config.implementation.slice(2).toLowerCase());
  assert.equal(BigInt(duration!), config.maxLockTime);
  positions.push({ asset, escrow: config.escrow, token, implementation,
    maximumLockSeconds: config.maxLockTime.toString(), maximumLockDays: Number(config.maxLockTime / 86400n),
    maxDurationStorageSlot: LOCK_MAX_TIME_SLOT, totalCount: locks.totalCount, locks: locks.locks });
}
const [native, erc20, decimals, symbol] = await Promise.all([
  rpc.getBalance({ address: owner, blockNumber }),
  rpc.readContract({ address: BTC_ASSET.address, abi: erc20Abi, functionName: "balanceOf", args: [owner], blockNumber }),
  rpc.readContract({ address: BTC_ASSET.address, abi: erc20Abi, functionName: "decimals", blockNumber }),
  rpc.readContract({ address: BTC_ASSET.address, abi: erc20Abi, functionName: "symbol", blockNumber }),
]);
assert.equal(native, erc20);
assert.equal(decimals, 18);
assert.equal(symbol, "BTC");
// Existing protocol NFTs exercise the actual three-field return format. They
// are not Pocket customer activity and no new lock is created by this check.
let observedProtocolPosition = null;
const newestId = await rpc.readContract({ address: LOCK_CONTRACTS.btc.escrow, abi: LOCK_ABI, functionName: "tokenId", blockNumber });
for (let id = newestId; id > 0n && id > newestId - 10n; id--) {
  try {
    const [holder, locked] = await Promise.all([
      rpc.readContract({ address: LOCK_CONTRACTS.btc.escrow, abi: LOCK_ABI, functionName: "ownerOf", args: [id], blockNumber }),
      rpc.readContract({ address: LOCK_CONTRACTS.btc.escrow, abi: LOCK_ABI, functionName: "locked", args: [id], blockNumber }),
    ]);
    observedProtocolPosition = { tokenId: id.toString(), owner: holder, amountWei: locked.amount.toString(),
      end: locked.end.toString(), permanent: locked.isPermanent, pocketCustomerEvidence: false };
    break;
  } catch { /* A burned ID has no owner; inspect the preceding ID. */ }
}
assert.ok(observedProtocolPosition, "Could not verify an existing veBTC NFT with the BTC ABI");
const report = { checkedAt: new Date().toISOString(), chainId, blockNumber: blockNumber.toString(), owner,
  officialDeploymentSource: "https://github.com/mezo-org/tigris/blob/0a3b5e840ac8e187cc705fbeddcf00f88b09247e/solidity/deployments/testnet/VeBTC.json",
  nativeBtcEqualsErc20Balance: true, btcDecimals: decimals, btcSymbol: symbol, positions, observedProtocolPosition,
  clientLockAsset: "BTC", liveBtcLockCreated: false, financialBroadcasts: 0 };
await writeFile("docs/evidence/btc-lock-readiness-2026-11-12.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
