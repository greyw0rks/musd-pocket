import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { recordDirectPayment } from "@/lib/payments/direct";

/** Verify a transfer already signed by the caller. Never broadcasts a payment. */
export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const sender = await getUserByWallet(identity.walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);
    const result = await recordDirectPayment(
      sender,
      await req.json().catch(() => null),
    );
    return Response.json(result, {
      status: result.status === "PENDING" ? 202 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
