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
import { normaliseHandle, validateHandleFormat } from "@/features/session/handle";

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
 * Only `username` is writable, because only `username` exists on the server
 * User row. The UI's profile carries a name, an avatar, an account type and a
 * business name; none of those have a column, so sending them here is a no-op
 * rather than a silent write. Accepting a field the database cannot hold would
 * be the more comfortable choice and the dishonest one.
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
    if (!body || typeof body.username !== "string") {
      throw new HttpError("Send a username to update.");
    }

    const username = normaliseHandle(body.username);
    const problem = validateHandleFormat(username);
    if (problem) throw new HttpError(problem);

    if (username === user.username) {
      return Response.json(serializeUser(user)); // nothing to do
    }

    const taken = await getUserByUsername(username);
    if (taken) throw new HttpError("That username is already taken.", 409);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username },
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
