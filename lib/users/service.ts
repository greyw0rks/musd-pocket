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
