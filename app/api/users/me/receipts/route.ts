import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIdentity, errorResponse, HttpError } from "@/lib/auth/request";
import { getPrivyUser } from "@/lib/auth/privy-server";
import { getReceiptPreference } from "@/lib/users/receipts";

const email = z.string().trim().toLowerCase().max(254).email();
const input = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), address: email }).strict(),
  z.object({ channel: z.literal("google") }).strict(),
]);

export async function GET(request: NextRequest) {
  try {
    const identity = await requireIdentity(request);
    return Response.json(await getReceiptPreference(identity.walletAddress), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const identity = await requireIdentity(request);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError("Enter a valid email address.");
    // A Google address comes only from the caller's trusted linked account.
    const candidate = parsed.data.channel === "google"
      ? (await getPrivyUser(identity.privyId)).google?.email
      : parsed.data.address;
    const address = email.safeParse(candidate);
    if (!address.success) throw new HttpError("Connect your Google account before saving its receipt address.", 409);
    const data = { channel: parsed.data.channel, address: address.data };
    await prisma.receiptPreference.upsert({
      where: { walletAddress: identity.walletAddress },
      create: { walletAddress: identity.walletAddress, ...data }, update: data,
    });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const identity = await requireIdentity(request);
    await prisma.receiptPreference.deleteMany({ where: { walletAddress: identity.walletAddress } });
    return Response.json(null);
  } catch (error) { return errorResponse(error); }
}
