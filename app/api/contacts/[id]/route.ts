import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { updateContactSchema } from "@/lib/requests/schema";
import { toStorageAddress } from "@/lib/utils";

/**
 * Rename or delete one of the caller's own contacts.
 *
 * Both operations are scoped by `ownerAddress` *and* id in the same statement
 * (`updateMany` / `deleteMany`), so a contact id belonging to somebody else
 * matches zero rows and comes back 404 — the same answer as an id that does
 * not exist. A 403 here would confirm that the row exists, which is a fact
 * about another user's contact list that the caller has no business learning.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await requireIdentity(req);
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid label" }, { status: 400 });
    }

    const ownerAddress = toStorageAddress(identity.walletAddress);
    const { count } = await prisma.contact.updateMany({
      where: { id, ownerAddress },
      data: { label: parsed.data.label },
    });
    if (count === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const contact = await prisma.contact.findUnique({ where: { id } });
    return Response.json(contact);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await requireIdentity(req);
    const { id } = await params;

    const ownerAddress = toStorageAddress(identity.walletAddress);
    const { count } = await prisma.contact.deleteMany({
      where: { id, ownerAddress },
    });
    if (count === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
