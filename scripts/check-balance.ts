/*
  Independent balance read.

    node --experimental-strip-types --env-file=.env scripts/check-balance.ts 0x…

  A number on Home means nothing until it matches one the app did not produce.
  This asks the RPC the app is configured for — same chain, same token — and
  reads `balanceOf` straight from the contract with a call the app never makes,
  then prints what the app's own converters turn that into.

  Two deliberate splits:

    - The chain read is independent; the unit conversion is the app's own
      (`features/payments/amount.ts`, covered by `npm run test:amount`).
      Re-deriving the 18→2 decimal maths here would only re-test it.

    - The *configuration* is shared on purpose. Reading a hardcoded address
      would let this script agree with a wrong screen about the wrong token.

  Disagreement is the useful outcome: it means the screen is wrong.

  The ABI is inlined rather than imported from `lib/mezo/musd.ts` because that
  module's relative import is extensionless, which bare `node` will not
  resolve — and a check that will not run is not a check. What follows is the
  whole contract surface this needs.
*/
import { createPublicClient, http, getAddress, formatUnits as formatNative } from "viem";
import {
  ACTIVE_ENV,
  CHAIN_ID,
  MUSD_ADDRESS,
  MUSD_DECIMALS,
  MUSD_SYMBOL,
  RPC_URL,
  activeChain,
} from "../lib/mezo/config.ts";
import { formatUnits, toDisplayUnits, UNIT_SHIFT } from "../features/payments/amount.ts";

const ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const input = process.argv[2];
if (!input) {
  console.error("usage: node --experimental-strip-types scripts/check-balance.ts <address>");
  process.exit(2);
}

let address: `0x${string}`;
try {
  address = getAddress(input);
} catch {
  console.error(`not an address: ${input}`);
  process.exit(2);
}

const client = createPublicClient({ chain: activeChain, transport: http(RPC_URL) });

/** Wei as a BTC decimal, trimmed to what it actually needs. Wei stays exact. */
function btc(wei: bigint): string {
  /*
    `frac` defaults rather than being destructured bare: viem renders a whole
    number of ether as `"0"`, with no decimal point at all, so a wallet with no
    gas — the case this figure exists to report — would crash the script that
    reports it. `btcAmount` in `hooks/use-live-wallet.ts` has the same default
    for the same reason.
  */
  const [whole, frac = ""] = formatNative(wei, MUSD_DECIMALS).split(".");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

const [raw, symbol, decimals, gas, gasPrice] = await Promise.all([
  client.readContract({
    address: MUSD_ADDRESS,
    abi: ABI,
    functionName: "balanceOf",
    args: [address],
  }),
  client.readContract({ address: MUSD_ADDRESS, abi: ABI, functionName: "symbol" }),
  client.readContract({ address: MUSD_ADDRESS, abi: ABI, functionName: "decimals" }),
  // Native balance. Gas on Mezo is BTC, not mUSD, so a send costs this and
  // never the token — which is why the token figure below must not move by
  // anything except the amount sent.
  client.getBalance({ address }),
  client.getGasPrice(),
]);

const units = toDisplayUnits(raw);
const dust = raw % UNIT_SHIFT;
/*
  Cost of one send, so "can this wallet move money" is answered here rather
  than discovered by a user retrying against a wall.

  Gas is BTC, not mUSD, so a funded mUSD balance with an empty gas balance is
  a real and confusing state. The figure is an estimate — an ERC-20 `transfer`
  to a fresh recipient is around 51k gas, and 65k is kept as the ceiling for a
  first-time recipient whose storage slot is cold. `estimateGas` would be
  exact but requires the sender to be able to pay, which is the question.
*/
const GAS_ESTIMATE = 65_000n;
const cost = GAS_ESTIMATE * gasPrice;
/*
  State the headroom as a number of sends rather than a difference in BTC.
  Mezo gas is cheap enough that the difference is nine decimal places of
  nothing, which reads as zero and tells nobody anything; the multiple is the
  thing that answers "is gas going to stop me".
*/
const sends = cost > 0n ? gas / cost : null;

console.log("address:   ", address);
console.log("network:   ", `${ACTIVE_ENV} — chain ${CHAIN_ID}`);
console.log("rpc:       ", RPC_URL);
console.log("token:     ", MUSD_ADDRESS);
console.log("symbol:    ", symbol);
console.log("decimals:  ", decimals.toString());
console.log("");
console.log("mUSD raw:  ", raw.toString());
console.log("mUSD shown:", formatUnits(units));
console.log("minor units:", units.toString());
console.log(
  "truncated: ",
  dust > 0n ? `${dust} (${formatNative(dust, MUSD_DECIMALS)}) below 2dp` : "none",
);
console.log("");
console.log("gas:       ", `${gas.toString()} wei (${btc(gas)} BTC)`);
console.log("gas price: ", `${gasPrice.toString()} wei per gas`);
console.log(
  "one send:  ",
  `~${cost.toString()} wei (${btc(cost)} BTC) at ${GAS_ESTIMATE.toLocaleString("en-US")} gas — estimate`,
);
console.log(
  "can send:  ",
  gas > cost ? `yes — gas covers ~${sends} sends` : `no — short by ${btc(cost - gas)} BTC`,
);

/*
  The config check. `lib/mezo/config.ts` carries the symbol and decimals as
  constants on the strength of a docs read; this is the one place they are
  compared against what the contract itself answers.

  The question being asked is "is this the token the app thinks it is", which
  is a question about identity — so the symbol is compared case-insensitively.
  Ticker casing is a brand register, not a fact: the contract answers "MUSD",
  Mezo's docs and this app's prose both write "mUSD", and failing on that
  difference would make this script cry wolf on something that is not wrong.
  It is still printed, because it is a real discrepancy between two things
  both claiming to name the token.

  Decimals get no such latitude. They are the multiplier every amount is
  scaled by, so a disagreement there means every figure the app derives is
  wrong by a power of ten.
*/
const problems: string[] = [];
if (symbol.toUpperCase() !== MUSD_SYMBOL.toUpperCase()) {
  problems.push(`symbol is "${symbol}", config says "${MUSD_SYMBOL}"`);
} else if (symbol !== MUSD_SYMBOL) {
  console.log("");
  console.log(`note:      contract answers "${symbol}", config writes "${MUSD_SYMBOL}"`);
}
if (decimals !== MUSD_DECIMALS) {
  problems.push(`decimals are ${decimals}, config says ${MUSD_DECIMALS}`);
}
if (problems.length > 0) {
  console.log("");
  for (const problem of problems) console.error(`MISMATCH:  ${problem}`);
  process.exit(1);
}
