import { NextResponse } from "next/server";
import type { Hash } from "viem";
import { payRequestSchema } from "@/lib/requests/schema";
import {
  getByShortId,
  markProcessing,
  confirmPaid,
} from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
import { verifyMusdPayment } from "@/lib/mezo/verify";

/**
 * Payer-submitted proof of payment. The frontend sends only a tx hash;
 * the SERVER independently reads the chain and decides PAID — never the client.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = payRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid transaction hash" },
      { status: 400 },
    );
  }

  const req = await getByShortId(shortId);
  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status === "PAID") {
    return NextResponse.json(serializeRequest(req)); // idempotent
  }

  const result = await verifyMusdPayment({
    txHash: parsed.data.txHash as Hash,
    recipient: req.recipientAddress,
    amount: req.amount.toString(),
  });

  if (!result.valid) {
    if (result.pending) {
      // Tx not mined yet — record it and tell the client to keep polling.
      const updated = await markProcessing(req.shortId, parsed.data.txHash);
      return NextResponse.json(
        { ...serializeRequest(updated), pending: true },
        { status: 202 },
      );
    }
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  const paid = await confirmPaid(req.shortId, {
    txHash: parsed.data.txHash,
    payerAddress: result.from,
  });
  return NextResponse.json(serializeRequest(paid));
}
