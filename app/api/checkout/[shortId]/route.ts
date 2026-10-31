import { requireIdentity, errorResponse, HttpError } from "@/lib/auth/request";
import { getByShortId, isPublicRequestId, assertRequestPayer, reconcileRequestPayments } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
export async function GET(req: Request, { params }: { params: Promise<{ shortId: string }> }) {
  try {
    const { shortId } = await params;
    const identity = !isPublicRequestId(shortId) ? await requireIdentity(req) : null;
    let row = await getByShortId(shortId);
    if (!row) throw new HttpError("Payment link not found.", 404);
    if (identity && ![row.creatorAddress, row.recipientAddress, row.intendedPayerAddress, row.payerAddress].includes(identity.walletAddress.toLowerCase())) throw new HttpError("This older link is private to its participants.", 403);
    if (row.status === "PROCESSING") {
      await reconcileRequestPayments({ shortId }, 1);
      row = (await getByShortId(shortId))!;
    }
    return Response.json(serializeRequest(row), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request, { params }: { params: Promise<{ shortId: string }> }) {
  try {
    const identity = await requireIdentity(req);
    const { shortId } = await params;
    const row = await getByShortId(shortId);
    if (!row) throw new HttpError("Payment link not found.", 404);
    assertRequestPayer(row, identity.walletAddress);
    if (row.status !== "PENDING") throw new HttpError("This invoice is no longer open. Refresh to see its status.", 409);
    return Response.json(serializeRequest(row));
  } catch (error) { return errorResponse(error); }
}
