import { NextRequest, NextResponse } from "next/server";
import {
  createRequestSchema,
  expiryToHours,
} from "@/lib/requests/schema";
import {
  createPaymentRequest,
  listByCreator,
} from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { creatorAddress, recipientAddress, amount, description, expiry } =
    parsed.data;

  const req = await createPaymentRequest({
    creatorAddress,
    recipientAddress,
    amount,
    description,
    expiresInHours: expiryToHours(expiry),
  });

  return NextResponse.json(serializeRequest(req), { status: 201 });
}

export async function GET(request: NextRequest) {
  const creator = request.nextUrl.searchParams.get("creator");
  const status = request.nextUrl.searchParams.get("status");
  if (!creator) {
    return NextResponse.json(
      { error: "Missing creator address" },
      { status: 400 },
    );
  }

  const validStatus = ["PENDING", "PROCESSING", "PAID", "EXPIRED"].includes(
    status ?? "",
  )
    ? (status as "PENDING" | "PROCESSING" | "PAID" | "EXPIRED")
    : undefined;

  const rows = await listByCreator(creator, validStatus);
  return NextResponse.json(rows.map(serializeRequest));
}
