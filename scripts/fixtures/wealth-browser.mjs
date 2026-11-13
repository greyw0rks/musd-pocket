// Browser-only RPC and wallet fixtures. The component test never reaches a live RPC.
import { decodeFunctionData, encodeFunctionResult, erc20Abi } from "viem";
import {
  ESCROW,
  FACTORY,
  LOCK_ABI,
  BTC_ASSET,
  POOLS,
  ROUTER_ABI,
} from "@/lib/mezo/wealth/contracts";

export const owner = "0x1111111111111111111111111111111111111111";
const unit = 10n ** 18n;
const time = BigInt(Math.floor(Date.now() / 1000));
const week = 604800n;
const locks = new Map([
  [42n, { amount: 20n * unit, end: 0n, isPermanent: true, boost: 0n }],
  [
    43n,
    {
      amount: 10n * unit,
      end: (time / week + 4n) * week,
      isPermanent: false,
      boost: 0n,
    },
  ],
  [44n, { amount: 5n * unit, end: time - week, isPermanent: false, boost: 0n }],
]);
const allowances = new Map();
const transactions = new Map();
window.fixtureTransactions = [];
window.fixtureMode = "success";
const equal = (a, b) => a.toLowerCase() === b.toLowerCase();
function decode(call) {
  for (const abi of [
    erc20Abi,
    LOCK_ABI,
    ROUTER_ABI,
    [
      {
        type: "function",
        name: "claimFees",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ],
  ]) {
    try {
      return decodeFunctionData({ abi, data: call.data });
    } catch {
      /* Try the next ABI. */
    }
  }
  throw new Error("Unexpected fixture transaction");
}
function mined(hash) {
  if (window.fixtureMode === "pending")
    throw new Error("Fixture receipt timeout");
  const tx = transactions.get(hash);
  if (!tx) throw new Error("Unknown fixture hash");
  if (!tx.mined) {
    const { functionName, args = [] } = decode(tx);
    if (functionName === "approve")
      allowances.set(
        `${tx.to.toLowerCase()}:${args[0].toLowerCase()}`,
        args[1],
      );
    if (functionName === "createLock")
      locks.set(45n, {
        amount: args[0],
        end: ((time + args[1]) / week) * week,
        isPermanent: false,
        boost: 0n,
      });
    if (functionName === "increaseAmount") locks.get(args[0]).amount += args[1];
    if (functionName === "increaseUnlockTime")
      locks.get(args[0]).end = ((time + args[1]) / week) * week;
    if (functionName === "withdraw") locks.delete(args[0]);
    if (functionName === "unlockPermanent")
      Object.assign(locks.get(args[0]), {
        isPermanent: false,
        end: ((time + 208n * week) / week) * week,
      });
    if (functionName === "lockPermanent")
      Object.assign(locks.get(args[0]), { isPermanent: true, end: 0n });
    tx.mined = true;
  }
  return { status: "success", transactionHash: hash };
}
const rpc = {
  getChainId: async () => 31611,
  getBlock: async () => ({ number: 77n, timestamp: time }),
  getBlockNumber: async () => 77n,
  getStorageAt: async ({ slot }) => slot === `0x${"52".padStart(64, "0")}`
    ? `0x${(30n * 86400n).toString(16).padStart(64, "0")}`
    : "0x0000000000000000000000006bf4894dd2e113682db9d06555a0bfca9892917e",
  getGasPrice: async () => 1000000n,
  estimateGas: async () => 100000n,
  getBalance: async () => 100n * unit,
  call: async ({ data }) => ({
    data: data.startsWith("0x095ea7b3")
      ? encodeFunctionResult({
          abi: erc20Abi,
          functionName: "approve",
          result: true,
        })
      : "0x",
  }),
  simulateContract: async () => ({ result: [unit / 100n, 1000n] }),
  getTransaction: async ({ hash }) => {
    const tx = transactions.get(hash);
    if (!tx) throw new Error("Unknown fixture hash");
    return { ...tx, from: owner, input: tx.data };
  },
  getTransactionReceipt: async ({ hash }) => mined(hash),
  waitForTransactionReceipt: async ({ hash }) => mined(hash),
  readContract: async ({ address, functionName, args = [] }) => {
    const pool =
      POOLS.find((p) => equal(p.address, address)) ??
      POOLS.find(
        (p) =>
          args[1] &&
          typeof args[1] === "string" &&
          equal(p.token1.address, args[1]),
      ) ??
      POOLS[0];
    const otherUnit = 10n ** BigInt(pool.token1.decimals);
    switch (functionName) {
      case "token":
        return BTC_ASSET.address;
      case "token0":
        return pool.token0.address;
      case "token1":
        return pool.token1.address;
      case "stable":
        return pool.stable;
      case "factory":
      case "defaultFactory":
        return FACTORY;
      case "getPool":
        return pool.address;
      case "getFee":
        return pool.stable ? 1n : 4n;
      case "isPaused":
        return false;
      case "getReserves":
        return [10000n * unit, pool.stable ? 10000n * otherUnit : unit, time];
      case "totalSupply":
        return 100n * unit;
      case "balanceOf":
        return equal(address, ESCROW)
          ? BigInt(locks.size)
          : POOLS.some((p) => equal(p.address, address))
            ? BigInt(window.fixtureLpBalance ?? 10n * unit)
            : 10000n * unit;
      case "decimals":
        return (
          POOLS.find((p) => equal(p.token1.address, address))?.token1
            .decimals ?? 18
        );
      case "allowance":
        return (
          allowances.get(`${address.toLowerCase()}:${args[1].toLowerCase()}`) ??
          0n
        );
      case "quoteAddLiquidity":
        return [args[4], args[5], unit];
      case "quoteRemoveLiquidity":
        return [10n * unit, pool.stable ? 10n * otherUnit : unit / 1000n];
      case "getAmountsOut":
        return [
          args[0],
          equal(args[1][0].to, POOLS[0].token0.address) ? unit : unit / 1000n,
        ];
      case "ownerToNFTokenIdList":
        return [...locks.keys()][Number(args[1])];
      case "ownerOf":
        return owner;
      case "locked":
        return locks.get(args[0]);
      case "voted":
        return false;
      case "escrowType":
        return 0;
      case "vestingEnd":
        return 0n;
      default:
        throw new Error(`Unexpected fixture read: ${functionName}`);
    }
  },
};
const wallet = {
  account: { address: owner },
  chain: { id: 31611 },
  getChainId: rpc.getChainId,
  sendTransaction: async (call) => {
    if (window.fixtureMode === "reject") throw { code: 4001 };
    if (window.fixtureMode === "unknown")
      throw new Error("Fixture provider timeout");
    const hash = `0x${(transactions.size + 1).toString(16).padStart(64, "0")}`;
    transactions.set(hash, call);
    window.fixtureTransactions.push(decode(call).functionName);
    return hash;
  },
};
export const getPublicClient = () => rpc;
export const useWalletClient = () => ({ data: wallet });
export const useSession = () => ({ walletAddress: owner });
export const usePocket = () => ({
  session: { user: { id: "fixture", accountType: "personal" } },
  refresh: async () => {
    if (window.failRefresh) throw new Error("Fixture refresh failure");
  },
  saveProfile: async (input) => {
    window.lastProfile = input;
    return window.failSave ? "Could not save profile" : null;
  },
});
