import "server-only";
import {
  PrivyClient,
  type User as PrivyUser,
  type AuthTokenClaims,
  type LinkedAccountWithMetadata,
} from "@privy-io/server-auth";

/**
 * Server-side Privy: verify the access token a logged-in client sends, then
 * resolve the trusted identity behind it (embedded wallet + X / Telegram).
 *
 * The access token is the only thing we trust from the client; everything we
 * persist about a user (wallet address, X handle) comes from `getUser`, never
 * from the request body.
 */
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const appSecret = process.env.PRIVY_APP_SECRET ?? "";

let client: PrivyClient | null = null;

export function hasPrivyServer(): boolean {
  return appId.length > 0 && appSecret.length > 0;
}

export function getPrivyClient(): PrivyClient {
  if (!hasPrivyServer()) {
    throw new Error(
      "Privy server auth not configured (NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET).",
    );
  }
  if (!client) client = new PrivyClient(appId, appSecret);
  return client;
}

export async function verifyPrivyToken(token: string): Promise<AuthTokenClaims> {
  return getPrivyClient().verifyAuthToken(token);
}

export async function getPrivyUser(userId: string): Promise<PrivyUser> {
  // getUser(userId) is rate-limited at scale; fine for Pocket's demo volume.
  return getPrivyClient().getUser(userId);
}

type WalletAccount = Extract<LinkedAccountWithMetadata, { type: "wallet" }>;

/** Prefer the Privy embedded EOA; fall back to any linked wallet. */
function pickWallet(user: PrivyUser): WalletAccount | undefined {
  const wallets = user.linkedAccounts.filter(
    (a): a is WalletAccount => a.type === "wallet",
  );
  return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
}

export type PrivyIdentity = {
  privyId: string;
  walletAddress: string; // lowercase
  xId: string | null;
  xHandle: string | null;
  telegramId: string | null;
  telegramHandle: string | null;
};

/** Flatten a Privy user into the identity Pocket stores on `User`. */
export function extractIdentity(user: PrivyUser): PrivyIdentity {
  const wallet = pickWallet(user);
  const address = wallet?.address ?? user.wallet?.address ?? null;
  if (!address) {
    throw new Error("Privy user has no embedded wallet address yet.");
  }

  return {
    privyId: user.id,
    walletAddress: address.toLowerCase(),
    xId: user.twitter?.subject ?? null,
    xHandle: user.twitter?.username ?? null,
    telegramId: user.telegram?.telegramUserId ?? null,
    telegramHandle: user.telegram?.username ?? null,
  };
}

/** Verify a bearer token and resolve the identity behind it in one step. */
export async function identityFromToken(token: string): Promise<PrivyIdentity> {
  const { userId } = await verifyPrivyToken(token);
  const user = await getPrivyUser(userId);
  return extractIdentity(user);
}
