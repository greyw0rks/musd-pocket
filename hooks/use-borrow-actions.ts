"use client";

import { useCallback, useMemo, useRef } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { ApiError, useApi } from "@/lib/auth/client";
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
 *
 * `record` is kept out of that memo, exactly as in `useBtcActions`: it needs no
 * wallet, only `useApi`, whose identity changes when the access-token getter
 * does. A `useCallback` keeps it current without pinning the first fetch.
 */
export function useBorrowActions() {
  const { data } = useWalletClient();
  const fetchAuthed = useApi();

  const walletRef = useRef<WalletClient | null>(null);
  walletRef.current = (data as WalletClient | undefined) ?? null;

  const actions = useMemo(
    () => createBorrowActions({ getWalletClient: () => walletRef.current }),
    [],
  );

  /**
   * Ask the server to email the receipt for a write the wallet has already
   * made.
   *
   * `POST /api/borrow/record` — best-effort by design, like the payment and
   * withdrawal record calls. The transaction is on-chain either way; a failure
   * here means a missing email, not a failed loan, so this reports rather
   * than throws and the screen never treats it as the outcome of the write.
   *
   * The route re-reads the chain and decodes the calldata, so it is the
   * verifier here; this call only points it at a hash. A refusal (422, or a
   * 202 while the receipt is not readable yet) is worth a console line, not a
   * user-facing error.
   */
  const record = useCallback(
    async (txHash: `0x${string}`): Promise<void> => {
      try {
        await fetchAuthed<{ ok?: boolean; pending?: boolean }>(
          "/api/borrow/record",
          { method: "POST", body: JSON.stringify({ txHash }) },
        );
      } catch (e) {
        console.error("[pocket] borrow receipt not sent", {
          txHash,
          reason:
            e instanceof ApiError
              ? `${e.status} ${e.message}`
              : e instanceof Error
                ? e.message
                : String(e),
        });
      }
    },
    [fetchAuthed],
  );

  return useMemo(() => ({ ...actions, record }), [actions, record]);
}
