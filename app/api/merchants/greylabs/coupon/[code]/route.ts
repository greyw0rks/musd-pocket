import { prisma } from "@/lib/db";
import { greylabsAccess } from "@/lib/merchants/access";

/** Merch staff/customers can check a code without exposing its owner's identity. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^GREY-[A-F0-9]{16}$/.test(code)) return Response.json({ valid: false }, { status: 404 });
  const coupon = await prisma.merchantCoupon.findUnique({ where: { code }, select: { merchant: true, percent: true, userId: true } });
  const valid = coupon?.merchant === "greylabs" && (await greylabsAccess(coupon.userId)).eligible;
  return Response.json(valid ? { valid: true, merchant: "Greylabs", percent: coupon.percent } : { valid: false }, { status: valid ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
