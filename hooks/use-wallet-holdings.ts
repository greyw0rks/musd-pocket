"use client";

import { useQueries } from "@tanstack/react-query";
import { erc20Abi, type Address } from "viem";
import { useSession } from "@/lib/auth/session";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { activeEarn } from "@/lib/mezo/earn";
import { getPublicClient } from "@/lib/mezo/musd";
import { MEZO_ASSET, POOLS } from "@/lib/mezo/wealth/contracts";
import type { TokenHolding } from "@/components/pocket/home/BalanceCards";

// Supported wallet tokens only. Native BTC and mUSD already have primary reads;
// locked veMEZO NFTs are positions, rather than spendable MEZO balances.
const assets = [
  ...POOLS.slice(1).map(pool => ({ ...pool.token1, principal: false })),
  { ...MEZO_ASSET, principal: false },
  { address: activeEarn.savingsVault, symbol: "sMUSD", decimals: 18, principal: true },
  ...POOLS.map(pool => ({ address: pool.address, symbol: `${pool.token0.symbol}/${pool.token1.symbol} LP`, decimals: 18, principal: false })),
];

export function useWalletHoldings(enabled: boolean) {
  const { walletAddress } = useSession();
  const queries = useQueries({ queries: assets.map(asset => ({
    queryKey: ["wallet-token", CHAIN_ID, walletAddress, asset.address],
    queryFn: () => getPublicClient().readContract({ address: asset.address, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress as Address] }),
    enabled: enabled && ACTIVE_ENV === "testnet" && Boolean(walletAddress),
    refetchInterval: enabled ? 15_000 : false,
  })) });
  const holdings: TokenHolding[] = assets.flatMap((asset, index) => {
    const amount = queries[index].data;
    return amount !== undefined ? [{ label: asset.symbol, rawAmount: amount, decimals: asset.decimals, valueUnits: asset.principal ? amount / 10n ** 16n : null }] : [];
  });
  return { holdings, unavailable: enabled && queries.some(query => query.isError) };
}
