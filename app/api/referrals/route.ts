import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { acceptReferral } from "@/lib/rewards/referrals";

export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("Sign in before using this invite.", 404);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.code !== "string") throw new HttpError("Invalid invite link.");
    return Response.json(await acceptReferral(user, body.code), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
