import type { NextRequest } from "next/server";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { getByShortId } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";

/**
 * Read one payment request by its short id.
 *
 * The gate is "signed in", not "is the creator": the intended reader is the
 * person being asked to pay, who is a different account from the creator. So
 * an authenticated stranger can read it — that is the point of a request —
 * while an anonymous caller cannot enumerate short ids and harvest addresses
 * and amounts.
 *
 * Checkout keeps this authentication gate and uses unguessable 24-character
 * IDs. The payer signs in on the invoice URL before reading its details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> },
) {
  try {
    await requireIdentity(req);
    const { shortId } = await params;

    const request = await getByShortId(shortId);
    if (!request) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    return Response.json(serializeRequest(request));
  } catch (e) {
    return errorResponse(e);
  }
}
