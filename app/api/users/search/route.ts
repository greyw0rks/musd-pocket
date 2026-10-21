import type { NextRequest } from "next/server";
import { errorResponse, requireIdentity } from "@/lib/auth/request";
import { searchUsers } from "@/lib/users/service";

/**
 * GET /api/users/search?q=<fragment>
 *
 * The Send screen's "who is this?" search. While the user types a handle, this
 * answers with the Pocket users whose username contains what they typed, so a
 * person who is not in the contact book can still be paid without first being
 * saved.
 *
 * Signed-in only, unlike the exact-handle lookup next door. That route answers
 * a question about one name the caller already knows; this one answers "who
 * else is here?", and behind it is a browsable list of every user. Requiring a
 * Privy token keeps the directory from being a public scrape target. The caller
 * is excluded from their own results — the one person they can never pay.
 *
 * `q` is cleaned on the server as well as in the client: fragments shorter than
 * two characters return nothing rather than the whole table, and anything that
 * is not a handle character is dropped. The response is the picker's minimum —
 * handle, public address, avatar — never a balance or an email.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);

    const matches = await searchUsers(req.nextUrl.searchParams.get("q") ?? "", {
      excludeWallet: identity.walletAddress,
    });

    return Response.json({
      results: matches.map((user) => ({
        handle: user.username,
        address: user.walletAddress,
        avatarUrl: user.avatarUrl,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
