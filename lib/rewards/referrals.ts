import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/request";
import type { User } from "@prisma/client";

export const validReferralCode = (code: string) => /^[a-f0-9]{24}$/.test(code);

export async function referralCode(userId: string) {
  const code = await prisma.referralCode.upsert({
    where: { userId }, update: {}, create: { userId, code: randomBytes(12).toString("hex") },
  });
  return code.code;
}

export async function acceptReferral(user: User, code: string, now = new Date()) {
  if (!validReferralCode(code)) throw new HttpError("Invalid invite link.");
  const invitation = await prisma.referralCode.findUnique({ where: { code } });
  if (!invitation) throw new HttpError("This invite link is unavailable.", 404);
  if (invitation.userId === user.id) throw new HttpError("You cannot use your own invite link.", 409);
  const existing = await prisma.referral.findUnique({ where: { invitedId: user.id } });
  if (existing) return { accepted: existing.inviterId === invitation.userId };
  // Signup attribution only: old accounts and repeat logins never refresh progress.
  if (user.createdAt < invitation.createdAt || now.getTime() - user.createdAt.getTime() > 3600_000)
    throw new HttpError("Invites count when a new Pocket account joins.", 409);
  const joined = await prisma.referral.upsert({
    where: { invitedId: user.id }, update: {},
    create: { invitedId: user.id, inviterId: invitation.userId, joinedAt: user.createdAt },
  });
  return { accepted: joined.inviterId === invitation.userId };
}
