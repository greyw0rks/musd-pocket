import { requireIdentity, errorResponse, HttpError } from "@/lib/auth/request";
import { closeRequest } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
export async function POST(req: Request, { params }: { params: Promise<{ shortId: string }> }) {
  try {
    const identity = await requireIdentity(req);
    const body = await req.json().catch(() => null);
    if (body?.action !== "cancel" && body?.action !== "decline") throw new HttpError("Choose cancel or decline.");
    const { shortId } = await params;
    return Response.json(serializeRequest(await closeRequest(shortId, identity.walletAddress, body.action)));
  } catch (error) { return errorResponse(error); }
}
