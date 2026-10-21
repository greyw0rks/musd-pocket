import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PrivyIdentity } from "@/lib/auth/privy-server";
import type { PocketUser } from "@/lib/users/types";

/** Prisma `User` → client-safe DTO. Decimals become plain strings. */
export function serializeUser(user: User): PocketUser {
  return {
    id: user.id,
    username: user.username,
    walletAddress: user.walletAddress,
    xHandle: user.xHandle,
    avatarUrl: user.avatarUrl,
    telegramHandle: user.telegramHandle,
    preferredChain: user.preferredChain,
    availableBalance: user.availableBalance.toString(),
    frozenBalance: user.frozenBalance.toString(),
    createdAt: user.createdAt.toISOString(),
  };
}

/** Normalize a social handle into a username candidate: [a-z0-9_], 3–20 chars. */
function sanitizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

/** Pick a unique username from X/Telegram handle, else derive from the wallet. */
async function resolveUsername(identity: PrivyIdentity): Promise<string> {
  const fromHandle = identity.xHandle
    ? sanitizeHandle(identity.xHandle)
    : identity.telegramHandle
      ? sanitizeHandle(identity.telegramHandle)
      : "";
  const base =
    fromHandle.length >= 3
      ? fromHandle
      : `user${identity.walletAddress.slice(2, 8)}`;

  // First-come-first-served; collisions get a short numeric suffix.
  let candidate = base;
  for (let i = 0; i < 50; i++) {
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!taken) return candidate;
    candidate = `${base}${i + 1}`;
  }
  // Extremely unlikely fallback.
  return `${base}${Date.now().toString(36)}`;
}

/**
 * Upsert the Pocket user behind a verified Privy identity. Keyed on the
 * embedded wallet address; refreshes X/Telegram handles on every login.
 */
export async function upsertUserFromIdentity(
  identity: PrivyIdentity,
): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { walletAddress: identity.walletAddress },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        xId: identity.xId ?? undefined,
        xHandle: identity.xHandle ?? undefined,
        /*
          Refreshed on every login, so a changed X picture is picked up, but a
          login by a method that carries no picture (Telegram, email) does not
          erase one already stored. Same rule as the handles above: `undefined`
          means "nothing to say", not "set to null".
        */
        avatarUrl: identity.avatarUrl ?? undefined,
        telegramId: identity.telegramId ?? undefined,
        telegramHandle: identity.telegramHandle ?? undefined,
      },
    });
  }

  const username = await resolveUsername(identity);
  return prisma.user.create({
    data: {
      username,
      walletAddress: identity.walletAddress,
      xId: identity.xId,
      xHandle: identity.xHandle,
      avatarUrl: identity.avatarUrl,
      telegramId: identity.telegramId,
      telegramHandle: identity.telegramHandle,
    },
  });
}

export async function getUserByWallet(
  walletAddress: string,
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
  });
}

export async function getUserByUsername(
  username: string,
): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

/** A directory hit: only the fields a payer needs, and nothing else. */
export type DirectoryMatch = {
  username: string;
  walletAddress: string;
  avatarUrl: string | null;
};

/**
 * Find Pocket users whose username contains `query`.
 *
 * This is deliberately a different question from `getUserByUsername`: that one
 * answers "does this exact name exist?", while the search field has to answer
 * "who might you be typing?" — prefix or fragment, because a person remembers
 * the middle of a name as readily as its start.
 *
 * Two guards make a browsable directory tolerable:
 *
 *  - `query` is normalised and must be at least two characters, so an empty
 *    field is not a request for the whole user table;
 *  - `excludeWallet` drops the caller, who cannot pay themselves.
 *
 * The result set is capped, and it carries only what a picker renders — the
 * handle, the public address and the avatar. No balances, no emails, no
 * history.
 */
export async function searchUsers(
  query: string,
  options: { excludeWallet?: string; limit?: number } = {},
): Promise<DirectoryMatch[]> {
  const needle = query
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  if (needle.length < 2) return [];

  const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);

  return prisma.user.findMany({
    where: {
      username: { contains: needle },
      ...(options.excludeWallet
        ? { walletAddress: { not: options.excludeWallet.toLowerCase() } }
        : {}),
    },
    select: { username: true, walletAddress: true, avatarUrl: true },
    orderBy: { username: "asc" },
    take: limit,
  });
}
