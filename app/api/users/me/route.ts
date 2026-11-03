import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireIdentity,
  errorResponse,
  AuthError,
  HttpError,
} from "@/lib/auth/request";
import {
  upsertUserFromIdentity,
  getUserByWallet,
  getUserByUsername,
  serializeUser,
} from "@/lib/users/service";
import { profileUpdateSchema, profileData } from "@/lib/users/profile";

/**
 * POST /api/users/me — sync-on-login. Verifies the Privy token, resolves the
 * embedded wallet + X identity, upserts the Pocket user, returns it.
 */
export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await upsertUserFromIdentity(identity);
    return Response.json(serializeUser(user));
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * GET /api/users/me — the current user as Pocket sees them. 404 before the
 * first sync (POST) has run.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) {
      throw new AuthError("User not found — sync first", 404);
    }
    return Response.json(serializeUser(user));
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * PATCH /api/users/me — change the caller's own profile.
 *
 * Updates username and merchant preferences for the authenticated wallet.
 *
 * Races are real here: two requests can pass the availability check and then
 * collide on the unique index. That collision is caught (P2002) and reported as
 * the same 409 the pre-check would have produced, so a lost race looks to the
 * caller like the ordinary "taken" answer instead of a 500.
 */
export async function PATCH(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) {
      throw new AuthError("User not found — sync first", 404);
    }

    const body = await req.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpError(
        parsed.error.issues[0]?.message ?? "Invalid profile.",
      );
    const data = profileData(parsed.data, user);
    if (data.username && data.username !== user.username) {
      const taken = await getUserByUsername(data.username);
      if (taken) throw new HttpError("That username is already taken.", 409);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    return Response.json(serializeUser(updated));
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return Response.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }
    return errorResponse(e);
  }
}
