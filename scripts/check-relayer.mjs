// Ad-hoc relayer funding check. Run: node --env-file=.env scripts/check-relayer.mjs
import { createPublicClient, http, formatEther, formatUnits, getContract } from "viem";
import { mezoTestnet, mezo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const env = process.env.NEXT_PUBLIC_MEZO_ENV === "mainnet" ? "mainnet" : "testnet";
const chain = env === "mainnet" ? mezo : mezoTestnet;
const musd =
  env === "mainnet"
    ? "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186"
    : "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

const rpc = process.env.NEXT_PUBLIC_MEZO_RPC_URL || chain.rpcUrls.default.http[0];

const raw = process.env.RELAYER_PRIVATE_KEY;
if (!raw) throw new Error("RELAYER_PRIVATE_KEY not set");
const key = (raw.startsWith("0x") ? raw : `0x${raw}`);
const account = privateKeyToAccount(key);

const client = createPublicClient({ chain, transport: http(rpc) });

const erc20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];

const [btc, bal] = await Promise.all([
  client.getBalance({ address: account.address }),
  client.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] }),
]);

console.log(`env:          ${env} (chain ${chain.id})`);
console.log(`rpc:          ${rpc}`);
console.log(`relayer:      ${account.address}`);
console.log(`BTC (gas):    ${formatEther(btc)}`);
console.log(`mUSD balance: ${formatUnits(bal, 18)}`);
