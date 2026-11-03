import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { reconcileDirectPayments } from "@/lib/payments/direct";

/** Recheck only the caller's pending direct payments, without signing. */
export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const sender = await getUserByWallet(identity.walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);
    return Response.json(await reconcileDirectPayments(sender.id));
  } catch (error) {
    return errorResponse(error);
  }
}
