import "server-only";
import { prisma } from "@/lib/db";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { verifyMusdPayment } from "@/lib/mezo/verify";
import { paymentAmount } from "./amount";
import { HttpError } from "@/lib/auth/request";

export async function recordDirectPayment(sender: { id: string; walletAddress: string }, input: { txHash: string; recipient: string; amount: string }) {
  const hash = input.txHash.toLowerCase() as `0x${string}`;
  const to = input.recipient.toLowerCase();
  let amount: string;
  try { amount = paymentAmount(input.amount); } catch (e) { throw new HttpError((e as Error).message); }
  const existing = await prisma.payment.findUnique({ where: { paymentId: hash }, include: { recipient: true } });
  if (existing && (existing.mode !== "DIRECT" || existing.senderId !== sender.id ||
      (existing.recipientAddress ?? existing.recipient?.walletAddress)?.toLowerCase() !== to || existing.amount.toString() !== amount)) {
    throw new HttpError("That transaction belongs to a different payment.", 409);
  }
  if (existing?.status === "PAID") return { ok: true, id: existing.id, status: existing.status, idempotent: true };
  const proof = await verifyMusdPayment({ txHash: hash, recipient: to, amount, sender: sender.walletAddress });
  if (!proof.valid && !proof.pending) throw new HttpError(proof.reason, 422);
  // Unknown hashes never reserve an ID. A readable transaction must prove the
  // caller signed this exact token, recipient, and amount before filing pending.
  if (!proof.valid && !proof.verifiedIntent) return { ok: true, id: null, status: "PENDING" };
  const recipient = await prisma.user.findUnique({ where: { walletAddress: to }, select: { id: true } });
  const data = {
    mode: "DIRECT" as const, chainId: CHAIN_ID, token: MUSD_ADDRESS.toLowerCase(),
    senderId: sender.id, recipientId: recipient?.id ?? null, recipientAddress: to,
    amount, destChain: "MEZO" as const, payoutTxHash: hash,
    status: proof.valid ? "PAID" as const : "PENDING" as const,
    paidAt: proof.valid ? new Date(Number(proof.timestamp) * 1000) : null,
  };
  const row = await prisma.payment.upsert({
    where: { paymentId: hash }, create: { paymentId: hash, ...data },
    update: proof.valid ? data : {},
  });
  if (row.senderId !== sender.id || row.mode !== "DIRECT") throw new HttpError("Payment ownership conflict.", 409);
  return { ok: true, id: row.id, status: row.status };
}

/** Independent receipt recovery; never mutate wallets or the legacy ledger. */
export async function reconcileDirectPayments(senderId?: string, limit = 25) {
  const rows = await prisma.payment.findMany({
    where: { mode: "DIRECT", status: "PENDING", ...(senderId ? { senderId } : {}) },
    include: { sender: { select: { id: true, walletAddress: true } } },
    orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 100),
  });
  const report = { scanned: rows.length, finalized: 0, failed: 0, held: 0 };
  for (const row of rows) {
    try {
      const proof = await verifyMusdPayment({ txHash: row.paymentId as `0x${string}`, recipient: row.recipientAddress!, amount: row.amount.toString(), sender: row.sender.walletAddress });
      if (!proof.valid && proof.pending) { report.held++; continue; }
      if (!proof.valid) {
        await prisma.payment.updateMany({ where: { id: row.id, mode: "DIRECT", status: "PENDING" }, data: { status: "FAILED" } });
        report.failed++; continue;
      }
      const recipient = await prisma.user.findUnique({ where: { walletAddress: proof.to.toLowerCase() }, select: { id: true } });
      await prisma.payment.updateMany({ where: { id: row.id, mode: "DIRECT", status: "PENDING" }, data: { status: "PAID", recipientId: recipient?.id ?? null, paidAt: new Date(Number(proof.timestamp) * 1000) } });
      report.finalized++;
    } catch { report.held++; }
  }
  return report;
}
