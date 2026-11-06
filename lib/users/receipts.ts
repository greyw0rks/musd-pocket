import "server-only";
import { prisma } from "@/lib/db";
import type { ReceiptsLink } from "@/features/session/session.types";

export async function getReceiptPreference(walletAddress: string): Promise<ReceiptsLink | null> {
  const row = await prisma.receiptPreference.findUnique({ where: { walletAddress: walletAddress.toLowerCase() } });
  return row ? { channel: row.channel as ReceiptsLink["channel"], address: row.address } : null;
}
