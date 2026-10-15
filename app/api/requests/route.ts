import type { NextRequest } from "next/server";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { createRequestSchema, expiryToHours } from "@/lib/requests/schema";
import { createPaymentRequest, listByCreator } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";

const STATUSES = ["PENDING", "PROCESSING", "PAID", "EXPIRED"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Payment requests created *by* the caller.
 *
 * The creator used to arrive as `?creator=<address>` on GET and
 * `creatorAddress` in the POST body. Both were attacker-controlled, so either
 * could be pointed at a stranger's address to read their requests or to file a
 * request in their name. The creator is now the verified wallet behind the
 * bearer token and nothing else.
 */

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const body = await req.json().catch(() => null);
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const { recipientAddress, amount, description, expiry } = parsed.data;

    const req_ = await createPaymentRequest({
      creatorAddress: identity.walletAddress,
      recipientAddress,
      amount,
      description,
      expiresInHours: expiryToHours(expiry),
    });

    return Response.json(serializeRequest(req_), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);

    const raw = req.nextUrl.searchParams.get("status");
    const status = STATUSES.includes(raw as Status)
      ? (raw as Status)
      : undefined;

    const rows = await listByCreator(identity.walletAddress, status);
    return Response.json(rows.map(serializeRequest));
  } catch (e) {
    return errorResponse(e);
  }
}
