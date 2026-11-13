import "server-only";
import { prisma } from "@/lib/db";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { GREYLABS, type GreylabsAccess } from "./greylabs";

/** Only independently recorded, confirmed direct mUSD payments can unlock the offer. */
export async function greylabsAccess(userId: string): Promise<GreylabsAccess> {
  const merchant = await prisma.user.findUnique({ where: { username: GREYLABS.username }, select: { id: true, username: true, walletAddress: true, role: true } });
  if (!merchant || merchant.role !== "MERCHANT") return { eligible: false, recipient: null, coupon: null };
  const recipient = { id: merchant.id, name: GREYLABS.name, handle: GREYLABS.handle, address: merchant.walletAddress, verified: true };
  if (merchant.id === userId) return { eligible: false, recipient, coupon: null };
  const paid = await prisma.payment.findFirst({ where: {
    senderId: userId, recipientAddress: merchant.walletAddress, mode: "DIRECT", status: "PAID",
    chainId: CHAIN_ID, token: MUSD_ADDRESS.toLowerCase(), amount: { gt: 0 },
    payoutTxHash: { not: null }, paidAt: { not: null },
  }, select: { id: true } });
  if (!paid) return { eligible: false, recipient, coupon: null };
  const row = await prisma.merchantCoupon.findUnique({ where: { id: `${GREYLABS.id}:${userId}` } });
  return { eligible: true, recipient, coupon: row ? { code: row.code, percent: row.percent, merchant: GREYLABS.name, createdAt: row.createdAt.toISOString() } : null };
}
