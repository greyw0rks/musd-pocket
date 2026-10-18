"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PocketUser } from "@/lib/users/types";

/**
 * Pocket session: Privy auth state fused with the server-synced Pocket user.
 * One place the whole app reads "who am I + what's my balance" from.
 */
export type SessionValue = {
  /** Privy SDK finished booting. */
  ready: boolean;
  authenticated: boolean;
  /** Embedded wallet address (lowercase), once Privy has minted it. */
  walletAddress: string | null;
  /** The Pocket user row (balances, username), once synced. */
  user: PocketUser | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Signed in, but this account has no embedded wallet — so there is nothing to
   * sync and no address to pay from.
   *
   * This is a state and not an error, which is the whole point of it existing:
   * the two are handled differently and, before this field, the first had
   * nowhere to go but the loading spinner. See `WALLET_GRACE_MS`.
   */
  walletMissing: boolean;
  /** A wallet-creation call is in flight. */
  isCreatingWallet: boolean;
  /** Why the last wallet-creation call failed, if it did. */
  createWalletError: string | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Re-fetch the Pocket user (call after a balance-changing action). */
  refresh: () => Promise<void>;
  /** Ask Privy to mint the embedded wallet this account pays from. */
  createWallet: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * How long the server gets to answer before the client gives up on this try.
 *
 * Unbounded, a hung `/api/users/me` and a slow one are the same thing on screen
 * — the same spinner, forever — and nothing in the app ever ends that wait. A
 * retry is safe here because the route is an upsert keyed on the wallet: asking
 * twice leaves the same one row. The figure is generous on purpose; this is a
 * backstop against a request that will never answer, not a performance budget.
 */
const SYNC_TIMEOUT_MS = 20_000;

/**
 * How long a signed-in account gets to produce an embedded wallet before the app
 * concludes it has none.
 *
 * `createOnLogin: "users-without-wallets"` mints the wallet during login, so it
 * normally arrives in the same update that flips `authenticated` and this timer
 * never fires. For a moment before that it has not, and treating that moment as
 * a failure would flash a scary screen at every normal sign-in. A wallet still
 * missing after this long is a different fact — creation did not happen — and
 * the honest thing is to stop waiting and say so.
 */
const WALLET_GRACE_MS = 5_000;

async function syncUser(
  token: string | null,
  signal: AbortSignal,
): Promise<PocketUser> {
  if (!token) throw new Error("No access token");
  const res = await fetch("/api/users/me", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Sync failed");
  }
  return data as PocketUser;
}

/** Privy-backed session. Mount inside PrivyProvider + QueryClientProvider. */
export function SessionProvider({ children }: { children: ReactNode }) {
  /*
    Aliased to `privyUser`. `user` in this file's public vocabulary means the
    Pocket user — the value this provider exists to expose — and the Privy
    account of the same name is a different thing that happens to share it.
  */
  const { ready, authenticated, user: privyUser, login, logout, getAccessToken } =
    usePrivy();
  const { createWallet: createEmbeddedWallet } = useCreateWallet();
  const queryClient = useQueryClient();

  /*
    The address comes from `linkedAccounts`, preferring the embedded wallet —
    not from `user.wallet`.

    `user.wallet` is Privy's convenience field for "the user's wallet", and it
    is populated only once one wallet is unambiguously *the* wallet. A user who
    linked an external wallet before (or instead of) having an embedded one
    created can be signed in with `user.wallet` still undefined, and this
    expression is the gate for the whole app: `enabled` below is false, the
    Pocket user never syncs, and `AuthGate` spins on "Setting up your Pocket…"
    forever with a working session behind it.

    `linkedAccounts` is the list that is always populated, and picking the Privy
    embedded wallet out of it is what the server already does
    (`lib/auth/privy-server.ts`, `pickWallet`) — so both sides now name the same
    wallet for the same user, which they must, because the server stores that
    address and the client pays from it.
  */
  const walletAddress =
    (
      privyUser?.linkedAccounts.find(
        (a) => a.type === "wallet" && a.walletClientType === "privy",
      ) as { address?: string } | undefined
    )?.address?.toLowerCase() ??
    privyUser?.wallet?.address?.toLowerCase() ??
    null;
  const enabled = ready && authenticated && Boolean(walletAddress);

  /*
    A signed-in account with no embedded wallet, held back for a grace period.

    The state is *which* account has been given up on, not a boolean, and that
    is what removes the need to ever reset it. A boolean would have to be turned
    off the moment a wallet appears or a different account signs in — a write on
    every login, and a cascading render in the common case. Naming the account
    makes the reset fall out of the comparison: anything other than this exact
    account, wallet or no wallet, simply stops matching and the grace starts
    over by itself.

    `privyUser.id` is the account's DID, stable across sign-ins in a way an
    address cannot be here — the whole point is that this account has no
    address.
  */
  const walletlessKey =
    ready && authenticated && !walletAddress ? (privyUser?.id ?? null) : null;
  const [gaveUpOn, setGaveUpOn] = useState<string | null>(null);

  useEffect(() => {
    if (!walletlessKey) return;
    /*
      Armed on every wallet-less render and cleared on the way out, so the grace
      runs from the moment the account goes wallet-less and not from the first
      render after the app mounted. `setGaveUpOn` is called from the timeout and
      never from here — a synchronous write in an effect body renders twice for
      a state the app is about to read anyway.
    */
    const timer = setTimeout(() => setGaveUpOn(walletlessKey), WALLET_GRACE_MS);
    return () => clearTimeout(timer);
  }, [walletlessKey]);

  const walletMissing = Boolean(walletlessKey) && gaveUpOn === walletlessKey;

  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [createWalletError, setCreateWalletError] = useState<string | null>(
    null,
  );

  /*
    Creation is asked for, never automatic, and this is the reason: this is the
    wallet that holds the user's money and the address people pay them at. It
    appearing is a thing that happens to their account, so it is a thing they
    do. Privy creates it without showing any UI of its own, so the only feedback
    the user gets is what this provider reports.

    The call is idempotent in effect — Privy errors if a wallet already exists,
    and `linkedAccounts` will then carry it — so a double tap cannot mint two.
  */
  const createWallet = useCallback(async () => {
    setIsCreatingWallet(true);
    setCreateWalletError(null);
    try {
      await createEmbeddedWallet();
      /*
        No state is set from the result. The wallet that matters is the one
        Privy reports on the user, and that arrives through `usePrivy()` on the
        next render — which flips `walletAddress`, which enables the query. A
        local copy of the address here would be a second opinion about which
        wallet this account pays from, and it would win.
      */
    } catch (err) {
      setCreateWalletError(
        err instanceof Error ? err.message : "Could not create your wallet.",
      );
    } finally {
      setIsCreatingWallet(false);
    }
  }, [createEmbeddedWallet]);

  const query = useQuery({
    queryKey: ["pocket-user", walletAddress],
    enabled,
    staleTime: 10_000,
    queryFn: async ({ signal }) => {
      /*
        The caller's signal aborts when the query is superseded; the timeout
        covers the other case, a request that is simply never answered. Both
        reach `fetch`, so a hung sync ends as a `TimeoutError` rather than as a
        spinner with no exit.
      */
      const timeout = AbortSignal.timeout(SYNC_TIMEOUT_MS);
      const composed = AbortSignal.any([signal, timeout]);
      try {
        return await syncUser(await getAccessToken(), composed);
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new Error("Could not reach Pocket. Check your connection.");
        }
        throw err;
      }
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["pocket-user"] });
  }, [queryClient]);

  const value: SessionValue = {
    ready,
    authenticated,
    walletAddress,
    user: query.data ?? null,
    isLoading: !ready || (enabled && query.isPending),
    error: query.error instanceof Error ? query.error.message : null,
    walletMissing,
    isCreatingWallet,
    createWalletError,
    login: () => login(),
    logout,
    refresh,
    createWallet,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Static session for the no-Privy fallback stack (keys unset). */
export function NoAuthSessionProvider({ children }: { children: ReactNode }) {
  const value: SessionValue = {
    ready: true,
    authenticated: false,
    walletAddress: null,
    user: null,
    isLoading: false,
    error: "Auth is not configured (NEXT_PUBLIC_PRIVY_APP_ID unset).",
    /*
      Not "missing" — there is no account here to be missing a wallet, and
      there is no Privy to ask for one. `authenticated` being false is what
      tells the truth, and it is checked first.
    */
    walletMissing: false,
    isCreatingWallet: false,
    createWalletError: null,
    login: () => {},
    logout: async () => {},
    refresh: async () => {},
    createWallet: async () => {},
  };
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
