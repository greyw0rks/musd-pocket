"use client";

import { useMemo, useRef } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { createEarnActions } from "@/lib/mezo/earn-actions";

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
  const { data } = useWalletClient();

  const walletRef = useRef<WalletClient | null>(null);
  walletRef.current = (data as WalletClient | undefined) ?? null;

  return useMemo(
    () => createEarnActions({ getWalletClient: () => walletRef.current }),
    [],
  );
}
