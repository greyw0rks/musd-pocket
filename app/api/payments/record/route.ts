import { z } from "zod";
import { isAddress } from "viem";
import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { recordDirectPayment } from "@/lib/payments/direct";

const bodySchema = z.object({ txHash: z.string().regex(/^0x[\da-fA-F]{64}$/), recipient: z.string().refine(isAddress), amount: z.string() });

export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const sender = await getUserByWallet(identity.walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError("A transaction hash, recipient, and amount are required.");
    const result = await recordDirectPayment(sender, body.data);
    return Response.json(result, { status: result.status === "PENDING" ? 202 : 200 });
  } catch (error) { return errorResponse(error); }
}
