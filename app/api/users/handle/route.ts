import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/auth/request";
import { getUserByUsername } from "@/lib/users/service";
import { normaliseHandle, validateHandleFormat } from "@/features/session/handle";

/**
 * GET /api/users/handle?handle=<name>
 *
 * Answers two different questions with one lookup, because they are the same
 * question: "does this username belong to somebody, and to whom?"
 *
 *   - the sign-up screen asks it to know whether a handle is claimable;
 *   - the add-contact flow asks it to turn a handle into a payment address,
 *     since `Contact` stores an address and the user types a name.
 *
 * Unauthenticated on purpose. It has to run *before* an account exists (a
 * user picks their handle during onboarding), and it returns only what the
 * username itself already discloses: that the name is taken, and — if so — the
 * public wallet address it resolves to. That address is the same one the
 * person would hand out to be paid, so this exposes nothing a username does
 * not. No email, no balance, no history.
 *
 * Format and reservation are answered locally; only genuine availability costs
 * a query, and it is keyed on a unique index.
 */
export async function GET(req: NextRequest) {
  try {
    const handle = normaliseHandle(req.nextUrl.searchParams.get("handle") ?? "");

    const problem = validateHandleFormat(handle);
    if (problem) {
      return Response.json({
        handle,
        available: false,
        reason: problem,
        address: null,
      });
    }

    const user = await getUserByUsername(handle);
    if (!user) {
      return Response.json({
        handle,
        available: true,
        reason: null,
        address: null,
      });
    }

    return Response.json({
      handle,
      available: false,
      reason: "That username is already taken.",
      // The payer-facing address: what a contact entry needs, and what the
      // owner publishes to be paid. Nothing otherwise private rides along.
      address: user.walletAddress,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
