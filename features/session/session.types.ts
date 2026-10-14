/**
 * Who the user is, behind an interface.
 *
 * The build plan's rule for authentication before testnet is: mock the flow,
 * but design it so a real provider and embedded-wallet provisioning can be
 * added later. That means the UI must never call `localStorage` or a provider
 * SDK directly — it asks a `SessionService`, and the demo implements it.
 *
 * Nothing here is a credential. There is no password field, no token, no
 * recovery phrase, and no seed. The demo has no secrets to leak because it
 * never models one.
 */

export type AccountType = "personal" | "merchant";

/**
 * Where a session came from.
 *
 * X is the sign-in. Google is deliberately *not* in this union: it is not an
 * identity here, it is a delivery address, and the two are modelled apart
 * below. Folding them into one list is how a "Continue with Google" button
 * survives a decision to stop using Google to sign people in.
 */
export type AuthProvider = "demo" | "x" | "apple" | "email";

export const AUTH_PROVIDER_LABEL: Record<AuthProvider, string> = {
  demo: "Demo account",
  x: "X",
  apple: "Apple",
  email: "Email",
};

/** How a receipt copy reaches the user. */
export type ReceiptsChannel = "google" | "email";

export const RECEIPTS_CHANNEL_LABEL: Record<ReceiptsChannel, string> = {
  google: "Google",
  email: "Email",
};

/**
 * Where receipts and payment notices are sent.
 *
 * Separate from the session because it answers a different question. `provider`
 * is who you are; this is only where a copy of a payment notice goes, and the
 * app is fully usable with none connected.
 *
 * This is why signing in with X leaves it empty rather than filling it from a
 * profile: X returns a name and a subject and no address at all. An address is
 * something the user connects afterwards, on purpose, for delivery.
 */
export interface ReceiptsLink {
  channel: ReceiptsChannel;
  address: string;
}

/**
 * The embedded wallet, as a status rather than an address.
 *
 * Section 10 is explicit that before testnet the app may show a wallet
 * *interface* but must not claim a funded on-chain wallet. A bare
 * `address?: string` invites exactly that lie, so the absence is modelled
 * explicitly: `none` is a state the UI can render honestly.
 */
export type WalletStatus = "none" | "provisioning" | "ready";

export interface WalletLink {
  status: WalletStatus;
  address?: string;
}

export interface PocketUser {
  id: string;
  name: string;
  /** Includes the leading "@", because that is how it is displayed. */
  handle: string;
  avatarUrl?: string;
  accountType: AccountType;
  /** Business name, only meaningful when `accountType` is `merchant`. */
  businessName?: string;
  /** ISO-8601. */
  joinedAt: string;
  /**
   * Absent until the user connects one, and that absence is the normal state
   * rather than a gap to fill in. Screens say "Not set", not "—".
   */
  receipts?: ReceiptsLink;
}

export interface Session {
  user: PocketUser;
  provider: AuthProvider;
  wallet: WalletLink;
}

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: string };

export interface SignInRequest {
  provider: AuthProvider;
  /** Only used by the `email` provider; social providers ignore it. */
  email?: string;
  name?: string;
}

export interface ProfileUpdate {
  name?: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: AccountType;
  businessName?: string;
}

/** Why a handle cannot be taken, or `null` when it can. */
export type HandleProblem = string | null;

export interface SessionService {
  getSession(): Promise<Session | null>;
  signIn(request: SignInRequest): Promise<AuthResult>;
  signOut(): Promise<void>;
  updateProfile(update: ProfileUpdate): Promise<Session>;
  /**
   * Handle availability.
   *
   * Async because the real one is a network call, and a synchronous version
   * would make the spinner in the username field a decoration rather than a
   * state that actually happens.
   */
  checkHandle(handle: string): Promise<HandleProblem>;
  /**
   * Connect or disconnect the receipt address.
   *
   * `null` disconnects. One method rather than two because the two operations
   * write the same field, and a service that can only ever add is a service
   * whose user cannot leave.
   */
  setReceipts(link: ReceiptsLink | null): Promise<Session>;
}
