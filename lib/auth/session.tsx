"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
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
  login: () => void;
  logout: () => Promise<void>;
  /** Re-fetch the Pocket user (call after a balance-changing action). */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

async function syncUser(token: string | null): Promise<PocketUser> {
  if (!token) throw new Error("No access token");
  const res = await fetch("/api/users/me", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Sync failed");
  }
  return data as PocketUser;
}

/** Privy-backed session. Mount inside PrivyProvider + QueryClientProvider. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const queryClient = useQueryClient();

  const walletAddress = user?.wallet?.address?.toLowerCase() ?? null;
  const enabled = ready && authenticated && Boolean(walletAddress);

  const query = useQuery({
    queryKey: ["pocket-user", walletAddress],
    enabled,
    staleTime: 10_000,
    queryFn: async () => syncUser(await getAccessToken()),
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
    login: () => login(),
    logout,
    refresh,
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
    login: () => {},
    logout: async () => {},
    refresh: async () => {},
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
