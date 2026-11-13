"use client";

import { useEffect } from "react";
import { ApiError, useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";

const storageKey = "pocket:pending-invite:v1";

/** Retain a link through OAuth; credit only a verified new account on the server. */
export function ReferralAttribution() {
  const api = useApi();
  const { user } = useSession();
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref");
    if (code && /^[a-f0-9]{24}$/.test(code)) {
      try { localStorage.setItem(storageKey, JSON.stringify({ code, capturedAt: Date.now() })); } catch { /* Link remains in the current URL. */ }
    }
    if (!user) return;
    let pending = code;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (stored?.code && Date.now() - stored.capturedAt < 7 * 86400_000) pending = stored.code;
    } catch { /* Use the current link. */ }
    if (!pending || !/^[a-f0-9]{24}$/.test(pending)) return;
    const clean = () => {
      try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
      const current = new URL(window.location.href);
      current.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", current);
    };
    let cancelled = false;
    api("/api/referrals", { method: "POST", body: JSON.stringify({ code: pending }) })
      .then(() => { if (!cancelled) clean(); })
      .catch(error => { if (!cancelled && error instanceof ApiError && [400, 404, 409].includes(error.status)) clean(); });
    return () => { cancelled = true; };
  }, [api, user]);
  return null;
}
