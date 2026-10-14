/**
 * The demo session.
 *
 * A real provider is a redirect, a callback, and a server that mints a
 * session. None of that exists yet, so this stands in for it — but it stands
 * in for it *behind the same interface*, which is the whole point. Phase 4
 * replaces this file's export in `session.service.ts` and nothing in the UI
 * changes shape.
 *
 * What it deliberately does not do:
 *
 *  - it never issues a token, a password, or a recovery phrase;
 *  - it never provisions a wallet. `wallet.status` stays `"none"`, so the
 *    screens that show wallet state are showing the truth: nothing is
 *    connected, and that is what the user should see until testnet wiring.
 */

import type {
  AuthResult,
  HandleProblem,
  PocketUser,
  ProfileUpdate,
  ReceiptsLink,
  Session,
  SessionService,
  SignInRequest,
} from "@/features/session/session.types";

const STORAGE_KEY = "pocket.session.v1";
const LATENCY_MS = 550;

/** Handles that would be confusing or misleading if a user claimed one. */
const RESERVED_HANDLES = new Set([
  "pocket",
  "musd",
  "mezo",
  "admin",
  "support",
  "help",
  "official",
  "alex",
]);

/** Handles already taken by the seeded recipients. */
const TAKEN_HANDLES = new Set([
  "sarah",
  "designwithpavlo",
  "jordan",
  "chrisg",
  "emily",
  "taylor",
  "miamakes",
  "ravi",
  "nadia",
]);

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Validate a handle without touching storage.
 *
 * Exported and pure so the sign-up screen can show a problem as the user
 * types, while `checkHandle` below remains the async, authoritative answer.
 */
export function validateHandle(raw: string): HandleProblem {
  const handle = normaliseHandle(raw);

  if (handle.length === 0) return "Pick a username.";
  if (handle.length < 3) return "Usernames are at least 3 characters.";
  if (handle.length > 20) return "Usernames are at most 20 characters.";
  if (!HANDLE_PATTERN.test(handle))
    return "Use lowercase letters, numbers and underscores only.";
  if (RESERVED_HANDLES.has(handle)) return "That username is reserved.";
  if (TAKEN_HANDLES.has(handle)) return "That username is already taken.";

  return null;
}

function defaultNameFor(provider: SignInRequest["provider"]): string {
  // A social provider would return a real name. The demo is consistently one
  // person so the seeded history, contacts and receipts all line up.
  if (provider === "x") return "Alex Morgan";
  if (provider === "apple") return "Alex Morgan";
  return "Alex Morgan";
}

/**
 * The address a provider hands over, if any.
 *
 * X hands over none — it returns a name and a subject id and nothing else —
 * so signing in with X leaves the receipt address empty, which is the state
 * the profile screen is built to show. The email provider is the same address
 * the user just typed, because asking for one and then not using it would be
 * the odd thing to do.
 */
function signInReceiptsFor(
  provider: SignInRequest["provider"],
  email?: string,
): ReceiptsLink | undefined {
  if (provider !== "email") return undefined;
  const address = email?.trim() ?? "";
  return address ? { channel: "email", address } : undefined;
}

export function createDemoSessionService(): SessionService {
  let cache: Session | null = null;
  let loaded = false;

  function read(): Session | null {
    if (loaded) return cache;
    loaded = true;

    // No session on the server, and none during the first client render —
    // the app boots from `getSession()` in an effect instead, so hydration
    // has one deterministic answer to render.
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      cache = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      // A corrupt or unavailable store is not worth crashing the app over;
      // the user simply signs in again.
      cache = null;
    }

    return cache;
  }

  function write(next: Session | null) {
    cache = next;
    loaded = true;

    if (typeof window === "undefined") return;

    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private browsing, a full quota, a disabled store. The session still
      // works for this tab; it just will not survive a reload.
    }
  }

  function wait(ms = LATENCY_MS) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  return {
    async getSession() {
      await wait(260);
      return read();
    },

    async signIn(request: SignInRequest): Promise<AuthResult> {
      await wait();

      if (request.provider === "email") {
        const email = request.email?.trim() ?? "";
        if (!email) return { ok: false, error: "Enter an email address." };
        if (!email.includes("@"))
          return { ok: false, error: "That does not look like an email." };
      }

      const existing = read();

      // Signing in again as the same demo person keeps the profile they set
      // up rather than resetting it to a blank handle. The receipt address is
      // one of the things preserved: connecting one and then signing in again
      // should not silently drop it.
      const user: PocketUser = existing
        ? {
            ...existing.user,
            receipts:
              existing.user.receipts ??
              signInReceiptsFor(request.provider, request.email),
          }
        : {
            id: "usr_demo_01",
            name: request.name?.trim() || defaultNameFor(request.provider),
            handle: "",
            avatarUrl: undefined,
            accountType: "personal",
            joinedAt: new Date().toISOString(),
            receipts: signInReceiptsFor(request.provider, request.email),
          };

      const session: Session = {
        user,
        provider: request.provider,
        // Section 10: no funded wallet is claimed before testnet.
        wallet: { status: "none" },
      };

      write(session);
      return { ok: true, session };
    },

    async signOut() {
      await wait(320);
      write(null);
    },

    async updateProfile(update: ProfileUpdate) {
      const current = read();
      if (!current) {
        throw new Error("Cannot update a profile with no session.");
      }

      const next: Session = {
        ...current,
        user: {
          ...current.user,
          ...update,
          handle:
            update.handle !== undefined
              ? `@${normaliseHandle(update.handle)}`
              : current.user.handle,
        },
      };

      write(next);
      return next;
    },

    async checkHandle(handle: string) {
      // Deliberately slower than the pure validator, so the field's spinner
      // is a real state rather than a flash.
      await wait(420);
      return validateHandle(handle);
    },

    async setReceipts(link: ReceiptsLink | null) {
      const current = read();
      if (!current) {
        throw new Error("Cannot set a receipt address with no session.");
      }

      // Written through the same store as everything else, so a reload keeps
      // it. When this is wired to a real provider this becomes the call that
      // grants it the mailbox — which is the part that will need consent
      // screens, and is why the UI already separates it from signing in.
      const next: Session = {
        ...current,
        user: { ...current.user, receipts: link ?? undefined },
      };

      await wait(380);
      write(next);
      return next;
    },
  };
}
