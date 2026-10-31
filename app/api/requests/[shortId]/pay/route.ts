import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { payRequestSchema } from "@/lib/requests/schema";
import { confirmRequestPayment } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
import type { Hash } from "viem";

export async function POST(req: Request, { params }: { params: Promise<{ shortId: string }> }) {
  try {
    const sender = await getUserByWallet((await requireIdentity(req)).walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);
    const input = payRequestSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) return Response.json({ error: "Invalid transaction hash" }, { status: 400 });
    const { shortId } = await params;
    const result = await confirmRequestPayment(shortId, input.data.txHash as Hash, sender);
    return Response.json({ ...serializeRequest(result.request), pending: result.pending }, { status: result.pending ? 202 : 200 });
  } catch (error) { return errorResponse(error); }
}
