"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";

import { RECEIPT_GOOGLE_PENDING, RECEIPT_GOOGLE_RESULT } from "./google-events";

/** Mounted outside Profile so a full OAuth return can finish saving the preference. */
export function ReceiptGoogleSync() {
  const { user, authenticated, ready } = usePrivy();
  const { refresh } = useSession();
  const api = useApi();
  const attempted = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const address = user?.google?.email;
  useEffect(() => {
    if (!ready || !authenticated || !address || !user) return;
    let marker: string | null;
    try { marker = localStorage.getItem(RECEIPT_GOOGLE_PENDING); } catch { return; }
    if (!marker || attempted.current === marker) return;
    let pending: { userId: string; createdAt: number };
    try { pending = JSON.parse(marker); } catch { localStorage.removeItem(RECEIPT_GOOGLE_PENDING); return; }
    if (pending.userId !== user.id || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > 600_000 || pending.createdAt > Date.now()) {
      localStorage.removeItem(RECEIPT_GOOGLE_PENDING); return;
    }
    attempted.current = marker;
    void api("/api/users/me/receipts", { method: "PUT", body: JSON.stringify({ channel: "google" }) })
      .then(async () => {
        localStorage.removeItem(RECEIPT_GOOGLE_PENDING);
        await refresh();
        setMessage("Google receipt address saved.");
        window.dispatchEvent(new CustomEvent(RECEIPT_GOOGLE_RESULT, { detail: { saved: true } }));
      }).catch(() => {
        localStorage.removeItem(RECEIPT_GOOGLE_PENDING);
        const error = "Your Google account connected, but its receipt address could not be saved. Open Receipts and try again.";
        setMessage(error);
        window.dispatchEvent(new CustomEvent(RECEIPT_GOOGLE_RESULT, { detail: { error } }));
      });
  }, [ready, authenticated, address, user, api, refresh]);
  return message ? <button type="button" role="status" aria-label="Dismiss receipt notice" className="fixed bottom-24 left-4 right-4 z-50 rounded-xl bg-neutral-900 p-4 text-sm text-white" onClick={() => setMessage(null)}>{message}</button> : null;
}
