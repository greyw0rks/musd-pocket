import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { issueGreylabsCoupon } from "@/lib/merchants/coupons";
import { greylabsAccess } from "@/lib/merchants/access";

export async function GET(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("Sign in to view the Greylabs offer.", 404);
    return Response.json(await greylabsAccess(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("Sign in to reveal your Greylabs discount.", 404);
    const access = await greylabsAccess(user.id);
    if (!access.recipient) return Response.json({ error: "Greylabs payments are temporarily unavailable." }, { status: 503 });
    if (!access.eligible) return Response.json({ error: "Send a positive mUSD payment to @grey_labs and wait for confirmation to unlock your discount.", code: "GREYLABS_PAYMENT_REQUIRED" }, { status: 409 });
    return Response.json(await issueGreylabsCoupon(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
