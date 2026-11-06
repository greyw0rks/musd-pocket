import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { issueGreylabsCoupon } from "@/lib/merchants/coupons";

export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("Sign in to reveal your Greylabs discount.", 404);
    return Response.json(await issueGreylabsCoupon(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
