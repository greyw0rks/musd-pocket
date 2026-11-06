import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { getWaitlistCheckout } from "@/lib/waitlist/checkout";
import { serializeRequest } from "@/lib/requests/serialize";

/** Payer, merchant and price come from verified identity and the approved offer. */
export async function POST(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const request = await getWaitlistCheckout(identity.walletAddress);
    return Response.json(serializeRequest(request));
  } catch (error) {
    return errorResponse(error);
  }
}
