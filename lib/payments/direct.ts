import "server-only";
import { Prisma, type Payment } from "@prisma/client";
import type { Hash } from "viem";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/request";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { directPaymentSchema, type DirectPaymentInput } from "./schema";
import { verifyDirectTransfer } from "./verify";

type Sender = { id: string; walletAddress: string };
export type DirectPaymentResult = {
  ok: true;
  id: string | null;
  status: "PAID" | "PENDING" | "FAILED";
  idempotent?: boolean;
};

/** Record independently verified wallet transfers. Never import the ledger here. */
export async function recordDirectPayment(
  sender: Sender,
  input: DirectPaymentInput,
): Promise<DirectPaymentResult> {
  const parsed = directPaymentSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      "A valid transaction hash, recipient, and exact amount are required.",
    );
  const { txHash: hash, recipient: to } = parsed.data;
  const amount = new Prisma.Decimal(parsed.data.amount);
  const token = MUSD_ADDRESS.toLowerCase();

  function assertSamePayment(row: Payment) {
    if (
      row.mode !== "DIRECT" ||
      row.senderId !== sender.id ||
      row.chainId !== CHAIN_ID ||
      row.token !== token ||
      row.recipientAddress !== to ||
      !row.amount.equals(amount) ||
      row.payoutTxHash !== hash ||
      row.paymentId !== hash
    ) {
      throw new HttpError(
        "That transaction belongs to a different payment record.",
        409,
      );
    }
  }
  function result(row: Payment, idempotent = false): DirectPaymentResult {
    assertSamePayment(row);
    if (!["PAID", "PENDING", "FAILED"].includes(row.status))
      throw new HttpError("This payment record needs review.", 409);
    return {
      ok: true,
      id: row.id,
      status: row.status as DirectPaymentResult["status"],
      idempotent,
    };
  }

  let existing = await prisma.payment.findUnique({
    where: { paymentId: hash },
  });
  if (existing) {
    assertSamePayment(existing);
    if (existing.status !== "PENDING") return result(existing, true);
  }

  const proof = await verifyDirectTransfer({
    txHash: hash as Hash,
    sender: sender.walletAddress,
    recipient: to,
    amount: amount.toFixed(),
  });
  if (!proof.valid && !proof.pending && !proof.reverted)
    throw new HttpError(proof.reason, 422);
  // Unknown hashes never reserve an ID: the signer and calldata must be readable.
  if (!proof.valid && proof.pending && !proof.verifiedIntent)
    return { ok: true, id: existing?.id ?? null, status: "PENDING" };

  const recipient = await prisma.user.findUnique({
    where: { walletAddress: to },
    select: { id: true },
  });
  const status: DirectPaymentResult["status"] = proof.valid
    ? "PAID"
    : proof.reverted
      ? "FAILED"
      : "PENDING";
  const paidAt = proof.valid ? new Date(Number(proof.timestamp) * 1000) : null;
  const data = {
    mode: "DIRECT" as const,
    chainId: CHAIN_ID,
    token,
    senderId: sender.id,
    recipientId: recipient?.id ?? null,
    recipientAddress: to,
    amount,
    destChain: "MEZO" as const,
    status,
    payoutTxHash: hash,
    paidAt,
  };

  if (!existing) {
    try {
      return result(
        await prisma.payment.create({ data: { paymentId: hash, ...data } }),
      );
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "P2002"
      )
        throw error;
      // Re-read a concurrent winner BEFORE writing. Never upsert over another
      // owner's record and check ownership after the mutation.
      existing = await prisma.payment.findUnique({
        where: { paymentId: hash },
      });
      if (!existing) throw error;
      assertSamePayment(existing);
    }
  }
  if (existing.status !== "PENDING" || status === "PENDING")
    return result(existing, true);
  const changed = await prisma.payment.updateMany({
    where: {
      id: existing.id,
      paymentId: hash,
      mode: "DIRECT",
      status: "PENDING",
      senderId: sender.id,
      recipientAddress: to,
      amount,
      token,
      chainId: CHAIN_ID,
      payoutTxHash: hash,
    },
    data: { status, paidAt, recipientId: recipient?.id ?? null },
  });
  return result(
    await prisma.payment.findUniqueOrThrow({ where: { paymentId: hash } }),
    changed.count === 0,
  );
}

/** Retry receipts without signing, refunding, or releasing ledger balances. */
export async function reconcileDirectPayments(senderId?: string, limit = 25) {
  const rows = await prisma.payment.findMany({
    where: {
      mode: "DIRECT",
      status: "PENDING",
      ...(senderId ? { senderId } : {}),
    },
    include: { sender: { select: { id: true, walletAddress: true } } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(Number.isFinite(limit) ? limit : 25, 100)),
  });
  const report = { scanned: rows.length, finalized: 0, failed: 0, held: 0 };
  for (const row of rows) {
    try {
      if (
        row.mode !== "DIRECT" ||
        row.chainId !== CHAIN_ID ||
        row.token !== MUSD_ADDRESS.toLowerCase() ||
        !row.recipientAddress
      ) {
        report.held++;
        continue;
      }
      const recorded = await recordDirectPayment(row.sender, {
        txHash: row.paymentId,
        recipient: row.recipientAddress,
        amount: row.amount.toFixed(),
      });
      if (recorded.idempotent || recorded.status === "PENDING") report.held++;
      else if (recorded.status === "PAID") report.finalized++;
      else report.failed++;
    } catch {
      // Missing metadata, RPC failures, and mismatching proofs need review,
      // not an invented failure/refund. Continue with the other pending rows.
      report.held++;
    }
  }
  return report;
}
