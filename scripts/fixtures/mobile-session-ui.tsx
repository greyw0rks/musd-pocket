import { useSyncExternalStore, useEffect } from "react";
import { createApiSessionService } from "@/features/session/api-session.adapter";

const fixture = window as typeof window & Record<string, any>;
localStorage.setItem("pocket:walkthrough:v1", "1");
fixture.fixtureVersion = 0;
fixture.fixtureAuthenticated = true;
fixture.fixtureGoogle = localStorage.getItem("fixture:google") === "1";
fixture.fixtureLoginOpen = false;
fixture.fixtureLoginCount = 0;
fixture.fixtureCalls = [];
const update = () => { fixture.fixtureVersion++; window.dispatchEvent(new Event("fixture:change")); };
const subscribe = (callback: () => void) => { window.addEventListener("fixture:change", callback); return () => window.removeEventListener("fixture:change", callback); };
const useVersion = () => useSyncExternalStore(subscribe, () => fixture.fixtureVersion);
const noop = () => {};
const refresh = async () => {};
const wallet = "0x1111111111111111111111111111111111111111";
const user = { id: "fixture-owner", username: "builder", role: "PERSONAL", businessName: null, walletAddress: wallet, xHandle: "builder", avatarUrl: null, telegramHandle: null, preferredChain: "MEZO", availableBalance: "40", frozenBalance: "0", createdAt: new Date().toISOString() };
const preference = () => JSON.parse(localStorage.getItem("fixture:receipts") ?? "null");
const login = () => { fixture.fixtureLoginOpen = true; fixture.fixtureLoginCount++; update(); };
const logout = async () => {
  if (fixture.fixtureFailLogout) throw Error("Fixture logout failure");
  fixture.fixtureAuthenticated = false; update();
};
export function useSession() {
  useVersion();
  return { ready: true, authenticated: fixture.fixtureAuthenticated, user: fixture.fixtureAuthenticated ? { ...user, receipts: preference() } : null, walletAddress: wallet, error: null, login, logout, refresh, walletMissing: false };
}
export function usePrivy() {
  useVersion();
  return { ready: true, authenticated: fixture.fixtureAuthenticated, user: fixture.fixtureAuthenticated ? { id: "did:privy:fixture", google: fixture.fixtureGoogle ? { email: "owner@gmail.com" } : undefined, linkedAccounts: [] } : null, login, logout };
}
export function useLinkAccount() {
  return { linkGoogle: () => { fixture.fixtureGoogle = true; localStorage.setItem("fixture:google", "1"); update(); } };
}
export function useMfa() { return { mfaMethods: [] }; }
export function useMfaEnrollment() { return { showMfaEnrollmentModal: noop, unenrollWithPasskey: refresh }; }
export const hasPrivy = () => true;
export class ApiError extends Error {}
export const api = async (path: string, init?: RequestInit) => {
  fixture.fixtureCalls.push({ path, method: init?.method ?? "GET", body: init?.body });
  if (path === "/api/users/me") return { ...user, receipts: preference() };
  if (path === "/api/users/me/receipts") {
    if (fixture.fixtureFailReceipt) throw Error("Receipt address could not be saved.");
    if (init?.method === "DELETE") { localStorage.removeItem("fixture:receipts"); return null; }
    const body = JSON.parse(String(init?.body));
    const result = body.channel === "google" ? { channel: "google", address: "owner@gmail.com" } : { channel: "email", address: body.address.trim().toLowerCase() };
    localStorage.setItem("fixture:receipts", JSON.stringify(result)); return result;
  }
  throw Error("Fixture has no financial snapshot for this screen.");
};
export const useApi = () => api;
export function FixtureLogin() {
  useVersion();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { fixture.fixtureLoginOpen = false; update(); } };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, []);
  return fixture.fixtureLoginOpen ? <div role="dialog" aria-modal="true" aria-label="Fixture Privy chooser" style={{ position: "fixed", inset: 20, zIndex: 100, background: "white", padding: 24 }}><h2>Privy sign in</h2><p>X · Email</p><button onClick={() => { fixture.fixtureLoginOpen = false; update(); }}>Close chooser</button></div> : null;
}
export const services = {
  sessions: createApiSessionService({ fetchAuthed: api as any, login, logout, getWalletAddress: () => wallet }),
  payments: { getBalance: async () => 4000n, listTransactions: async () => [], send: async () => { throw Error("Financial signing is disabled in fixtures"); } },
  contacts: { list: async () => [], search: async () => [], resolveHandle: async () => null },
  requests: { list: async () => [], capabilities: { pay: true, decline: true, cancel: true } },
  initialSession: { user: { id: user.id, name: "builder", handle: "@builder", accountType: "personal", joinedAt: user.createdAt, receipts: preference() }, provider: "x", wallet: { status: "ready", address: wallet } },
};
export default function Link(props: any) { return <a {...props} />; }
export const useWalletHoldings = () => ({ holdings: [], unavailable: false });
export const useLiveWallet = () => null;
export const EmbeddedWalletActivator = () => null;
export const useBorrow = () => ({ data: { hasTrove: false, status: 0, statusLabel: "Not opened", collateral: "0", debt: "0", price: null, mcr: "1100000000000000000", collateralRatio: null, ltv: null, liquidationPrice: null, health: "none" }, isPending: false, isError: false, error: null, refetch: refresh, isFetching: false });
export const useFaucet = () => ({ data: null, loading: false, refresh, claim: null, amounts: { btc: "0.00001", musd: "20" }, funded: true, claiming: false, claimFaucet: refresh, clearError: noop });
export const useEarn = () => ({ data: { shares: "0", principal: "0", totalShares: "0", hasPosition: false, claimableYield: "0", vaultAcceptsMusd: true }, isPending: false, isError: false, error: null, refetch: refresh, isFetching: false });
export const useEarnActions = () => ({ pendingClaimHash: () => null, hasPendingClaim: () => false, canRetryClaim: () => false });
export const useBorrowActions = () => ({});
export const useBtcActions = () => ({});
export const useMusdBalance = () => ({ data: 0n, raw: 0n, formatted: "0", isLoading: false, refetch: refresh });
export const useMezoLocks = () => ({ data: undefined, isPending: false, error: null, refetch: refresh });
export const useWealthAction = () => ({ open: false, busy: false, close: noop, review: refresh });
export const useWelcomeReward = () => ({ data: null, loading: false, refresh });
export const useWalletClient = () => ({ data: undefined });
export const useAccount = () => ({ address: wallet, isConnected: true });
export const useBalance = () => ({ data: { value: 0n, formatted: "0" } });
