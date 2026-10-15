import type { Hash } from "viem";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { payRequestSchema } from "@/lib/requests/schema";
import {
  getByShortId,
  markProcessing,
  confirmPaid,
} from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
import { verifyMusdPayment } from "@/lib/mezo/verify";

/**
 * Payer-submitted proof of payment. The frontend sends only a tx hash; the
 * SERVER independently reads the chain and decides PAID — never the client.
 *
 * Signed-in callers only, for the same reason as the read route beside it: the
 * payer is a Pocket user today, and there is no external-wallet payer flow yet.
 * Identity is *not* used to authorise the payment itself — the chain is. A
 * caller cannot mark somebody else's request paid by claiming to be them; they
 * can only submit a hash that `verifyMusdPayment` confirms really moved the
 * right amount to the right address.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  try {
    await requireIdentity(req);
    const { shortId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = payRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    const request = await getByShortId(shortId);
    if (!request) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.status === "PAID") {
      return Response.json(serializeRequest(request)); // idempotent
    }

    const result = await verifyMusdPayment({
      txHash: parsed.data.txHash as Hash,
      recipient: request.recipientAddress,
      amount: request.amount.toString(),
    });

    if (!result.valid) {
      if (result.pending) {
        // Tx not mined yet — record it and tell the client to keep polling.
        const updated = await markProcessing(request.shortId, parsed.data.txHash);
        return Response.json(
          { ...serializeRequest(updated), pending: true },
          { status: 202 },
        );
      }
      return Response.json({ error: result.reason }, { status: 400 });
    }

    const paid = await confirmPaid(request.shortId, {
      txHash: parsed.data.txHash,
      payerAddress: result.from,
    });
    return Response.json(serializeRequest(paid));
  } catch (e) {
    return errorResponse(e);
  }
}
