/*
  Does the signed-in wallet actually HAVE a Trove?

  The Home card only draws the dual balance and the Repay button when
  `hasTrove` is true, so "I can't see it" has one obvious innocent explanation:
  there is no Trove to decompose. This asks the chain directly rather than the
  app, so an app-side read failure cannot masquerade as "no position".

  TroveManager.Trove.Status: 0 nonExistent / 1 active / 2 closedByOwner
                             3 closedByLiquidation / 4 closedByRedemption
*/
import { createPublicClient, http } from "viem";
import { mezoTestnet } from "viem/chains";

const TROVE_MANAGER = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0";

const ABI = [
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveDebt", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveColl", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveOwnersCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveFromTroveOwnersArray", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
];

const PRICE_FEED = "0x86bCF0841622a5dAC14A313a15f96A95421b9366";
const PRICE_FEED_ABI = [
  { type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

/** 150% CCR — the floor the open form enforces, so it is the honest ceiling here. */
const CCR = 150n * 10n ** 16n;
const MIN_NET_DEBT = 1800n * 10n ** 18n;
const E18 = 10n ** 18n;

const STATUS = ["nonExistent", "active", "closedByOwner", "closedByLiquidation", "closedByRedemption"];

const WALLETS = {
  "greyw0rks  (usually signed in)": "0xe66d1c48792a320c16d7abd90c835b25a0ac37db",
  "musd_pocket (the funded one)  ": "0x0a5e59ca4f182561de80172c6da5db927091ea29",
};

const client = createPublicClient({ chain: mezoTestnet, transport: http() });

for (const [name, address] of Object.entries(WALLETS)) {
  const status = await client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveStatus", args: [address] });
  const s = STATUS[Number(status)] ?? `unknown(${status})`;
  let line = `  ${name}  status=${s}`;
  if (Number(status) === 1) {
    const [debt, coll] = await Promise.all([
      client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveDebt", args: [address] }),
      client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveColl", args: [address] }),
    ]);
    line += `  debt=${debt}  coll=${coll}`;
  }
  console.log(line);
}

// Every Trove the protocol is currently tracking — so "your wallet has none"
// can be told apart from "there are none anywhere".
const count = await client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveOwnersCount" });
console.log(`\n  Troves tracked network-wide: ${count}`);
const shown = count > 5n ? 5n : count;
for (let i = 0n; i < shown; i++) {
  const owner = await client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveFromTroveOwnersArray", args: [i] });
  const status = await client.readContract({ address: TROVE_MANAGER, abi: ABI, functionName: "getTroveStatus", args: [owner] });
  console.log(`    [${i}] ${owner}  ${STATUS[Number(status)] ?? status}`);
}

// Could these wallets open one? Collateral is native BTC, so the question is
// whether the wallet holds enough of it — not whether it holds MUSD.
const price = await client.readContract({ address: PRICE_FEED, abi: PRICE_FEED_ABI, functionName: "fetchPrice" });
console.log(`\n  BTC price: $${Number(price) / 1e18}  (live oracle)`);
console.log(`  Floor to open: ${Number(MIN_NET_DEBT) / 1e18} MUSD net, at CCR ${Number(CCR) / 1e16}%\n`);
for (const [name, address] of Object.entries(WALLETS)) {
  const btc = await client.getBalance({ address });
  const collUsd = (btc * price) / E18;   // 18dp USD
  // debt / collateralValue <= 1/CCR, so the ceiling is collUsd * 100 / 150.
  // (Not `collUsd / (CCR / 1e18)` — that integer-divides to collUsd / 1.)
  const maxDebt = (collUsd * 100n) / 150n;
  console.log(`  ${name}`);
  console.log(`    BTC ${btc} (${Number(btc) / 1e18} BTC)`);
  console.log(`    collateral $${(Number(collUsd) / 1e18).toFixed(2)}  →  max debt at 150% ≈ ${(Number(maxDebt) / 1e18).toFixed(2)} MUSD`);
  console.log(`    ${maxDebt >= MIN_NET_DEBT ? "CAN open a Trove" : "TOO LITTLE collateral to open"}\n`);
}

