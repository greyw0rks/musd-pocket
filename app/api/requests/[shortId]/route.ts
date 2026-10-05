import { NextResponse } from "next/server";
import { getByShortId } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await params;
  const req = await getByShortId(shortId);
  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  return NextResponse.json(serializeRequest(req));
}
