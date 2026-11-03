import type { Hash } from "viem";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { payRequestSchema } from "@/lib/requests/schema";
import { settleCheckout, RevertedCheckoutError } from "@/lib/requests/checkout";
import { serializeRequest } from "@/lib/requests/serialize";

/**
 * Payer-submitted proof of payment. The frontend sends only a tx hash; the
 * SERVER independently reads the chain and decides PAID — never the client.
 *
 * Signed-in callers only, for the same reason as the read route beside it: the
 * payer is a Pocket user today, and there is no external-wallet payer flow yet.
 * The authenticated wallet must match the transaction signer and any intended
 * payer. Settlement verifies the transfer independently and records Activity
 * atomically with the invoice confirmation.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  try {
    const identity = await requireIdentity(req);
    const { shortId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = payRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid transaction hash" },
        { status: 400 },
      );
    }

    const result = await settleCheckout(
      shortId,
      identity.walletAddress,
      parsed.data.txHash as Hash,
    );
    return Response.json(
      { ...serializeRequest(result.request), pending: result.pending },
      { status: result.pending ? 202 : 200 },
    );
  } catch (e) {
    if (e instanceof RevertedCheckoutError)
      return Response.json(
        { error: e.message, code: "TRANSACTION_REVERTED" },
        { status: e.status },
      );
    return errorResponse(e);
  }
}
