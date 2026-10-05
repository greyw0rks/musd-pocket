import type { NextRequest } from "next/server";
import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import {
  upsertUserFromIdentity,
  getUserByWallet,
  serializeUser,
} from "@/lib/users/service";

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
