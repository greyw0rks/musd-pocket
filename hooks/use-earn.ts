"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { useApi } from "@/lib/auth/client";

/**
 * Shared read of the signed-in user's Mezo Savings Vault position, keyed
 * `["earn"]` so a deposit, a withdrawal or a claim invalidates one key and
 * every view of the vault refetches the same server-computed snapshot.
 *
 * The route answers with everything stringified, because these are 18-decimal
 * wei and would silently lose precision as JSON numbers. `EarnView` is that
 * wire shape, not the domain shape — `lib/mezo/earn.ts` holds the bigint
 * version, and the conversion happens once, at the edge.
 *
 * Unlike `useBorrow`, this polls slowly. A Trove's ratio moves with the BTC
 * price and a stale one is a stale warning; a savings balance only moves when
 * the holder acts, and every action invalidates this key directly. Fifteen
 * seconds here would be eighteen RPC reads a minute to watch a number that
 * cannot change on its own.
 */

export type EarnView = {
  /** sMUSD held, 18-decimal. */
  shares: string;
  /** The same figure in the unit it is spent in — MUSD. */
  principal: string;
  totalShares: string;
  hasPosition: boolean;
  /** `null` when the vault did not answer; never a fabricated zero. */
  claimableYield: string | null;
  /** `false` when the vault is pointed at a different MUSD; `null` if unread. */
  vaultAcceptsMusd: boolean | null;
};

export function useEarn() {
  const { user } = useSession();
  const api = useApi();

  return useQuery({
    queryKey: ["earn"],
    enabled: Boolean(user),
    queryFn: () => api<{ earn: EarnView }>("/api/earn").then((r) => r.earn),
    refetchInterval: 60_000,
  });
}
