/**
 * The real session adapter.
 *
 * Identity itself is Privy's: the token, the embedded wallet and the sign-in
 * modal all belong to `SessionProvider` (`lib/auth/session.tsx`), which has
 * already resolved a user by the time any screen in this app renders. What
 * this adapter adds is the *Pocket* view of that person — the username, the
 * join date, the wallet state — read from the server rather than invented.
 *
 * Two things are worth stating plainly, because both are places where a
 * plausible implementation would lie:
 *
 *  1. Receipt preferences are private and saved separately from public profile
 *     fields. Google addresses are resolved by the authenticated server.
 *  2. `provider` is inferred, not reported. The server records an X handle, and
 *     Privy knows the real method, but the two are not joined up in this
 *     payload, so a non-X sign-in is labelled `email` as the closest available
 *     member of the union. Nothing renders it today, so this is inert — the
 *     comment is here so it is not mistaken for a fact if it ever is rendered.
 */

import type {
  AuthProvider,
  AuthResult,
  HandleProblem,
  ProfileUpdate,
  Session,
  SessionService,
} from "@/features/session/session.types";
import { normaliseHandle } from "@/features/session/handle";
import { ApiError, type AuthedFetch } from "@/lib/auth/client";
import type { PocketUser as ServerPocketUser } from "@/lib/users/types";

/** The handle lookup the server exposes — see `app/api/users/handle/route.ts`. */
type HandleLookup = {
  handle: string;
  available: boolean;
  reason: string | null;
  address: string | null;
};

/**
 * Server user → UI user. Exported because the real mount already holds the
 * synced user when it builds the app, and using it there means the first
 * render shows the real profile instead of a blank one.
 *
 * The two types share a name and nothing else, so this mapping is the whole
 * reason the interface can stay stable across the swap.
 *
 * Merchant preferences are persisted in the user profile.
 */
export function sessionFromUser(
  user: ServerPocketUser,
  privyWallet: string | null = null,
): Session {
  const walletAddress = user.walletAddress || privyWallet;

  return {
    user: {
      id: user.id,
      name: user.username,
      handle: `@${user.username}`,
      accountType: user.role === "MERCHANT" ? "merchant" : "personal",
      businessName: user.businessName ?? undefined,
      /*
        The X profile picture, persisted at sign-in from Privy's identity
        payload (`lib/auth/privy-server.ts`) and refreshed on every login. It is
        dropped to `undefined` rather than `null` so the UI's optional field
        means "no picture" for both non-X logins and older rows that predate the
        column.
      */
      avatarUrl: user.avatarUrl ?? undefined,
      joinedAt: user.createdAt,
      receipts: user.receipts ?? undefined,
    },
    provider: providerOf(user),
    wallet: walletAddress
      ? { status: "ready", address: walletAddress }
      : // No address yet. Stated as `none` rather than `provisioning`, because
        // nothing is in fact being provisioned on our side — Privy mints the
        // wallet, and until it exists the truthful answer is that there is none.
        { status: "none" },
  };
}

function providerOf(user: ServerPocketUser): AuthProvider {
  return user.xHandle ? "x" : "email";
}

export function createApiSessionService(deps: {
  fetchAuthed: AuthedFetch;
  /** Opens the provider modal. The session arrives through `SessionProvider`. */
  login: () => void;
  logout: () => Promise<void>;
  /** The embedded wallet address, if Privy has minted one yet. */
  getWalletAddress: () => string | null;
}): SessionService {
  const { fetchAuthed, logout, getWalletAddress } = deps;

  async function readSession(): Promise<Session> {
    const user = await fetchAuthed<ServerPocketUser>("/api/users/me");
    return sessionFromUser(user, getWalletAddress());
  }

  return {
    async getSession(): Promise<Session | null> {
      try {
        return await readSession();
      } catch (e) {
        // A 404 means the user has not been synced yet, and a 401 means the
        // token was not accepted. Both are "not signed in" to this interface —
        // the caller routes to onboarding, and the shell will re-sync. Any
        // other failure is a real error and must not be swallowed into a
        // sign-out, which would silently log someone out on a flaky network.
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          return null;
        }
        throw e;
      }
    },

    async signIn(): Promise<AuthResult> {
      /*
        Unreachable by construction in the real app, and deliberately not
        faked: `AuthGate` renders nothing until the session resolves, so the
        welcome and auth screens are never mounted, and signing out unmounts
        the app rather than routing back to them. Opening the Privy modal from
        here would return before it resolved and report failure while the modal
        was still on screen — a worse lie than saying so.
      */
      return {
        ok: false,
        error: "Sign-in happens before the app opens. Reload to sign in.",
      };
    },

    async signOut(): Promise<void> {
      await logout();
    },

    async updateProfile(update: ProfileUpdate): Promise<Session> {
      const body = {
        ...(update.handle !== undefined
          ? { username: normaliseHandle(update.handle) }
          : {}),
        ...(update.accountType !== undefined
          ? { accountType: update.accountType }
          : {}),
        ...(update.businessName !== undefined
          ? { businessName: update.businessName }
          : {}),
      };
      if (Object.keys(body).length) {
        const user = await fetchAuthed<ServerPocketUser>("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        return sessionFromUser(user, getWalletAddress());
      }
      return readSession();
    },

    async checkHandle(handle: string): Promise<HandleProblem> {
      const raw = normaliseHandle(handle);
      const lookup = await fetchAuthed<HandleLookup>(
        `/api/users/handle?handle=${encodeURIComponent(raw)}`,
      );
      return lookup.available
        ? null
        : (lookup.reason ?? "That username is taken.");
    },

    async setReceipts(link): Promise<Session> {
      await fetchAuthed("/api/users/me/receipts", {
        method: link ? "PUT" : "DELETE",
        ...(link ? { body: JSON.stringify(link.channel === "google" ? { channel: "google" } : link) } : {}),
      });
      return readSession();
    },
  };
}
