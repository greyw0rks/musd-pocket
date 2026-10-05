import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createContactSchema } from "@/lib/requests/schema";
import { toStorageAddress } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  if (!owner) {
    return NextResponse.json({ error: "Missing owner" }, { status: 400 });
  }
  const rows = await prisma.contact.findMany({
    where: { ownerAddress: toStorageAddress(owner) },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid contact", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { ownerAddress, contactAddress, label } = parsed.data;

  // One label per (owner, contact) — upsert keeps it idempotent.
  const contact = await prisma.contact.upsert({
    where: {
      ownerAddress_contactAddress: {
        ownerAddress: toStorageAddress(ownerAddress),
        contactAddress: toStorageAddress(contactAddress),
      },
    },
    update: { label },
    create: {
      ownerAddress: toStorageAddress(ownerAddress),
      contactAddress: toStorageAddress(contactAddress),
      label,
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
