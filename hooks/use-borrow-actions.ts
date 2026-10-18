"use client";

import { useMemo, useRef } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { createBorrowActions } from "@/lib/mezo/borrow-actions";

/**
 * The borrow writes, bound to the user's own wallet.
 *
 * Borrow reads live in `use-borrow.ts` and deliberately sit outside the Pocket
 * store, because a Trove is not the app's money — it is a position the user
 * holds at Mezo. The writes belong in the same place for the same reason, so
 * this hook is the writes' half of that pair rather than a new entry in
 * `PocketServices`.
 *
 * The wallet client is read through a ref, which is the one non-obvious line
 * here. `createBorrowActions` is built once for the lifetime of the mount and
 * its `getWalletClient` is called at the moment of signing, so anything it
 * closed over would be frozen at the first render — and the first render of a
 * Privy embedded wallet is `undefined`, because the wallet only becomes the
 * active client once `EmbeddedWalletActivator` has made it one. Reading through
 * a ref that every render refreshes means the getter always sees the wallet
 * that exists *now*, which is the one the user is looking at when they press
 * the button. `app/(app)/home/page.tsx` solves the same problem the same way.
 *
 * `useMemo` with no dependencies is correct rather than lazy: the actions carry
 * no state, and rebuilding them per render would only hand the screens a new
 * object identity on every keystroke.
 */
export function useBorrowActions() {
  const { data } = useWalletClient();

  const walletRef = useRef<WalletClient | null>(null);
  walletRef.current = (data as WalletClient | undefined) ?? null;

  return useMemo(
    () => createBorrowActions({ getWalletClient: () => walletRef.current }),
    [],
  );
}
