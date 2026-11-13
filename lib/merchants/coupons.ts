import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { GREYLABS, type GreylabsCoupon } from "./greylabs";

export async function issueGreylabsCoupon(userId: string): Promise<GreylabsCoupon> {
  const coupon = await prisma.merchantCoupon.upsert({
    where: { id: `${GREYLABS.id}:${userId}` }, update: {},
    create: {
      id: `${GREYLABS.id}:${userId}`, userId, merchant: GREYLABS.id,
      code: `GREY-${randomBytes(8).toString("hex").toUpperCase()}`, percent: randomInt(10, 31),
    },
  });
  return { code: coupon.code, percent: coupon.percent, merchant: GREYLABS.name, createdAt: coupon.createdAt.toISOString() };
}
