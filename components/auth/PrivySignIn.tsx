"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/session";
import { hasPrivy } from "@/lib/wallet/privy";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

// Capture before Privy cleans the callback URL. Its callback/error modal must
// finish before a fresh login chooser is opened. Consume once per page load;
// a later logout still opens the chooser automatically.
let returningFromOAuth = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("privy_oauth_state");

/** A successful callback must not suppress the chooser on a later logout. */
export function PrivyOAuthReturn() {
  const { authenticated } = useSession();
  useEffect(() => { if (authenticated) returningFromOAuth = false; }, [authenticated]);
  return null;
}

/** One entry into Privy's X and email chooser, including after logout. */
export function PrivySignIn() {
  const { ready, authenticated, login } = useSession();
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || authenticated || opened.current || !hasPrivy()) return;
    opened.current = true;
    if (returningFromOAuth) { returningFromOAuth = false; return; }
    login();
  }, [ready, authenticated, login]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="justify-center text-2xl" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in to mPocket</h1>
        <p className="mt-3 text-[15px] text-muted">Use X or email to access your account.</p>
        <Button size="lg" fullWidth onClick={login} className="mt-8">Continue</Button>
      </div>
    </div>
  );
}
