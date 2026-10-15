import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { createContactSchema } from "@/lib/requests/schema";
import { toStorageAddress } from "@/lib/utils";

/**
 * The caller's own contacts.
 *
 * The owner is the verified wallet behind the bearer token. This route used to
 * take `?owner=<address>` and trust it, which meant anyone who knew an address
 * could read — and write — that person's contact list. The parameter is gone;
 * a spoofed one would now simply be ignored, because nothing reads it.
 */

export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const rows = await prisma.contact.findMany({
      where: { ownerAddress: toStorageAddress(identity.walletAddress) },
      orderBy: { label: "asc" },
    });
    return Response.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const body = await req.json().catch(() => null);
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid contact" }, { status: 400 });
    }

    const ownerAddress = toStorageAddress(identity.walletAddress);
    const contactAddress = toStorageAddress(parsed.data.contactAddress);

    if (ownerAddress === contactAddress) {
      return Response.json(
        { error: "You cannot add yourself as a contact." },
        { status: 400 },
      );
    }

    // One label per (owner, contact) — upsert keeps it idempotent.
    const contact = await prisma.contact.upsert({
      where: { ownerAddress_contactAddress: { ownerAddress, contactAddress } },
      update: { label: parsed.data.label },
      create: { ownerAddress, contactAddress, label: parsed.data.label },
    });
    return Response.json(contact, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
