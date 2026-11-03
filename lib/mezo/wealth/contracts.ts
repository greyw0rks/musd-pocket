import { parseAbi, type Address } from "viem";
import {
  MEZO_REWARD_TOKEN,
  TESTNET_VEMEZO,
  WELCOME_ESCROW_ABI,
} from "@/lib/rewards/abi";
import type { Asset } from "./types";

export const MEZO_ASSET: Asset = {
  address: MEZO_REWARD_TOKEN,
  symbol: "MEZO",
  decimals: 18,
};
export const ESCROW = TESTNET_VEMEZO;
export const MAX_LOCK_TIME = 208n * 604800n;
export const LOCK_ABI = [
  ...WELCOME_ESCROW_ABI,
  ...parseAbi([
    "function createLock(uint256 amount,uint256 duration) returns (uint256)",
    "function increaseAmount(uint256 tokenId,uint256 amount)",
    "function increaseUnlockTime(uint256 tokenId,uint256 duration)",
    "function lockPermanent(uint256 tokenId)",
    "function unlockPermanent(uint256 tokenId)",
    "function voted(uint256 tokenId) view returns (bool)",
    "function escrowType(uint256 tokenId) view returns (uint8)",
    "function vestingEnd(uint256 tokenId) view returns (uint256)",
  ]),
] as const;

export const ROUTER = "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9" as Address;
export const FACTORY = "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A" as Address;
export const ROUTER_ABI = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn,Route[] routes) view returns(uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,Route[] routes,address to,uint256 deadline) returns(uint256[] amounts)",
  "function defaultFactory() view returns(address)",
  "function quoteAddLiquidity(address tokenA,address tokenB,bool stable,address factory,uint256 amountADesired,uint256 amountBDesired) view returns(uint256 amountA,uint256 amountB,uint256 liquidity)",
  "function quoteRemoveLiquidity(address tokenA,address tokenB,bool stable,address factory,uint256 liquidity) view returns(uint256 amountA,uint256 amountB)",
  "function addLiquidity(address tokenA,address tokenB,bool stable,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns(uint256 amountA,uint256 amountB,uint256 liquidity)",
  "function removeLiquidity(address tokenA,address tokenB,bool stable,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns(uint256 amountA,uint256 amountB)",
]);
export const FACTORY_ABI = parseAbi([
  "function getPool(address tokenA,address tokenB,bool stable) view returns(address)",
  "function getFee(address pool,bool stable) view returns(uint256)",
  "function isPaused() view returns(bool)",
]);
export const POOL_ABI = parseAbi([
  "function token0() view returns(address)",
  "function token1() view returns(address)",
  "function stable() view returns(bool)",
  "function factory() view returns(address)",
  "function getReserves() view returns(uint256 reserve0,uint256 reserve1,uint256 timestamp)",
  "function claimFees() returns(uint256 claimed0,uint256 claimed1)",
]);
const musd: Asset = {
  address: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  symbol: "mUSD",
  decimals: 18,
};
export const POOLS = [
  {
    id: "musd-btc",
    address: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
    stable: false,
    token0: musd,
    token1: {
      address: "0x7b7C000000000000000000000000000000000000",
      symbol: "BTC",
      decimals: 18,
    },
  },
  {
    id: "musd-usdc",
    address: "0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e",
    stable: true,
    token0: musd,
    token1: {
      address: "0xe1a26db653708a2ad8f824e92db9852410e33a59",
      symbol: "mUSDC",
      decimals: 6,
    },
  },
  {
    id: "musd-usdt",
    address: "0x27414B76CF00E24ed087adb56E26bAeEEe93494e",
    stable: true,
    token0: musd,
    token1: {
      address: "0x629320719a6190bd145c277226fd45e7648f950a",
      symbol: "mUSDT",
      decimals: 6,
    },
  },
] as const satisfies readonly {
  id: string;
  address: Address;
  stable: boolean;
  token0: Asset;
  token1: Asset;
}[];
export type PoolId = (typeof POOLS)[number]["id"];
export function poolById(id: PoolId) {
  const pool = POOLS.find((pool) => pool.id === id);
  if (!pool) throw new Error("Unknown pool.");
  return pool;
}
