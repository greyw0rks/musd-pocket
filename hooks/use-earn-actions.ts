"use client";

import { useMemo } from "react";
import { useSessionWallet } from "@/hooks/use-session-wallet";
import { createEarnActions } from "@/lib/mezo/earn-actions";
import { pendingClaim } from "@/lib/mezo/claim-journal";

/**
 * The Savings Vault's write actions, bound to the user's wallet.
 *
 * A ref rather than a value: `createEarnActions` is built once and lives as
 * long as the mount, but the embedded wallet can arrive after the first render
 * (it has to, on a page that starts signed out). Handing the factory a getter
 * means the actions always see the current wallet without being rebuilt — and
 * rebuilding them would not help anyway, since a component holding the old
 * ones would keep calling the old ones.
 *
 * The same pattern as `use-borrow-actions`.
 */
export function useEarnActions() {
  const { getWalletClient, address } = useSessionWallet();

  return useMemo(
    () => ({ ...createEarnActions({ getWalletClient }), pendingClaimHash: () => address ? pendingClaim(address) : null }),
    [getWalletClient, address],
  );
}
