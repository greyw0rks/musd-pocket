import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateContactSchema } from "@/lib/requests/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }
  const contact = await prisma.contact
    .update({ where: { id }, data: { label: parsed.data.label } })
    .catch(() => null);
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(contact);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await prisma.contact
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
