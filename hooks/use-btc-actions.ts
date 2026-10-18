"use client";

import { useCallback, useMemo, useRef } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { ApiError, useApi } from "@/lib/auth/client";
import { createBtcActions } from "@/lib/mezo/btc-actions";

/**
 * What became of the attempt to file the transfer in Spending.
 *
 * Three states rather than a boolean, because they are three different things
 * to say. The transfer has already happened in all of them — this is only about
 * whether the history knows it — and the one outcome that must never be
 * confused with the others is `unknown`, which is the one that leaves no row.
 */
export type BtcRecordVerdict =
  | { state: "recorded" }
  | { state: "pending" }
  | { state: "unknown" };

/** What the record route is told about a transfer that is already on-chain. */
export type BtcRecordRequest = {
  txHash: `0x${string}`;
  toAddress: string;
  /** Human BTC, at most eight decimals — what the route verifies against. */
  amount: string;
};

/**
 * The BTC send, bound to the user's own wallet.
 *
 * Its own hook rather than an entry in `PocketServices`, for the same reason
 * borrow's writes are: this is not the app's money moving through the app's
 * rails. MUSD lives behind `PaymentService`, which the store owns; the chain's
 * gas token is moved by the wallet itself, so the store has no part in it and
 * inventing one would mean a service whose only job is to hold a wallet client.
 *
 * The wallet client is read through a ref, which is the one non-obvious line
 * here. `createBtcActions` is built once for the lifetime of the mount and its
 * `getWalletClient` is called at the moment of signing, so anything it closed
 * over would be frozen at the first render — and the first render of a Privy
 * embedded wallet is `undefined`, because the wallet only becomes the active
 * client once `EmbeddedWalletActivator` has made it one. Reading through a ref
 * that every render refreshes means the getter always sees the wallet that
 * exists *now*, which is the one the user is looking at when they press the
 * button.
 *
 * `record` is kept out of that memo. It needs no wallet — it is an HTTP call
 * about a transfer that has already been signed — and it does depend on
 * `useApi`, whose identity changes when the access-token getter does. Closing
 * it into the never-rebuilt memo would pin the first `fetchAuthed` forever,
 * which is what the ref above exists to avoid for the wallet; a `useCallback`
 * avoids the same trap without a second ref.
 *
 * The two are joined into one object only so a screen has one thing to hold.
 */
export function useBtcActions() {
  const { data } = useWalletClient();
  const fetchAuthed = useApi();

  const walletRef = useRef<WalletClient | null>(null);
  walletRef.current = (data as WalletClient | undefined) ?? null;

  const send = useMemo(
    () => createBtcActions({ getWalletClient: () => walletRef.current }),
    [],
  );

  /**
   * Tell the server about a transfer the wallet has already made.
   *
   * `POST /api/withdrawals/native` — the same shape as the MUSD record call in
   * `chain-payment.adapter`, and the same contract: best-effort by design,
   * because the money has moved either way and a bookkeeping failure must not
   * be reported as a transfer failure. The caller decides what to say about it;
   * this only reports what happened.
   *
   * It does not swallow the server's refusal silently, either: a 422 means the
   * route read the chain and disagreed with the claim, which is worth a console
   * line naming the reason even though the user is told simply that the
   * transfer is not in the history. The route is trusted with nothing — it
   * verifies the claim itself — so this is a report, not a decision.
   */
  const record = useCallback(
    async (request: BtcRecordRequest): Promise<BtcRecordVerdict> => {
      try {
        const res = await fetchAuthed<{ status?: string }>(
          "/api/withdrawals/native",
          { method: "POST", body: JSON.stringify(request) },
        );
        // `PENDING` is the route saying the chain had not confirmed it yet. The
        // row exists and is unconfirmed, which is a different sentence from
        // "there is no row".
        return res?.status === "COMPLETED" ? { state: "recorded" } : { state: "pending" };
      } catch (e) {
        console.error("[pocket] BTC transfer not recorded", {
          txHash: request.txHash,
          reason:
            e instanceof ApiError
              ? `${e.status} ${e.message}`
              : e instanceof Error
                ? e.message
                : String(e),
        });
        return { state: "unknown" };
      }
    },
    [fetchAuthed],
  );

  return useMemo(() => ({ ...send, record }), [send, record]);
}
