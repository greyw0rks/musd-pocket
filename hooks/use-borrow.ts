"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { useApi } from "@/lib/auth/client";
import type { TroveHealth } from "@/lib/mezo/borrow-math";
import { CHAIN_ID } from "@/lib/mezo/config";

/**
 * Shared read of the signed-in user's Mezo Borrow position, keyed by wallet
 * and chain, with the `["borrow"]` invalidation prefix,
 * so every borrow view stays in lockstep: an open or a repay that mines
 * invalidates this one key and every view refetches the same server-computed
 * snapshot.
 *
 * The route answers with everything stringified, because these are 18-decimal
 * wei and would silently lose precision as JSON numbers. `BorrowView` is that
 * wire shape, not the domain shape — `lib/mezo/borrow.ts` holds the bigint
 * version, and the conversion happens once, at the edge.
 *
 * The interval matches `useMusdBalance`'s: a Trove's ratio moves with the BTC
 * price, so a static dashboard would drift out of date without anyone touching
 * it.
 */

export type BorrowView = {
  hasTrove: boolean;
  status: number;
  statusLabel: string;
  collateral: string;
  debt: string;
  price: string | null;
  mcr: string;
  collateralRatio: string | null;
  ltv: string | null;
  liquidationPrice: string | null;
  health: TroveHealth;
};

export function useBorrow() {
  const { user, walletAddress } = useSession();
  const api = useApi();

  return useQuery({
    queryKey: ["borrow", CHAIN_ID, walletAddress],
    enabled: Boolean(user && walletAddress),
    queryFn: () =>
      api<{ borrow: BorrowView }>("/api/borrow").then((r) => r.borrow),
    refetchInterval: 15_000,
  });
}
