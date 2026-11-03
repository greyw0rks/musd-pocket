import "server-only";
import type { Hash } from "viem";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/request";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { getByShortId } from "./service";
import { verifyCheckoutTransfer } from "./verify";

export class RevertedCheckoutError extends HttpError {
  constructor() {
    super("The transaction reverted. You can try again.", 422);
  }
}

/** Retrying a proof never sends funds or releases a legacy ledger balance. */
export async function settleCheckout(
  shortId: string,
  wallet: string,
  transactionHash: Hash,
) {
  const request = await getByShortId(shortId);
  if (!request) throw new HttpError("Request not found", 404);
  const payer = wallet.toLowerCase();
  const hash = transactionHash.toLowerCase() as Hash;
  if (
    request.version !== 2 ||
    request.recipientAddress !== request.creatorAddress ||
    request.chainId !== CHAIN_ID ||
    request.token.toLowerCase() !== MUSD_ADDRESS.toLowerCase()
  ) {
    throw new HttpError(
      "This older payment link cannot be paid. Ask for a new link.",
      409,
    );
  }
  if (request.intendedPayerAddress && request.intendedPayerAddress !== payer)
    throw new HttpError(
      "This request is addressed to a different wallet.",
      403,
    );
  if (request.recipientAddress === payer)
    throw new HttpError("This is your own payment request.", 409);
  if (request.status === "PAID" || request.status === "LATE_PAID") {
    if (request.txHash !== hash || request.payerAddress !== payer)
      throw new HttpError("This request has already been paid.", 409);
    return { request, pending: false };
  }
  if (request.status === "CANCELLED" || request.status === "DECLINED")
    throw new HttpError("This request is closed.", 409);
  if (request.txHash && request.txHash !== hash)
    throw new HttpError(
      "Another transaction is already being checked for this request.",
      409,
    );

  const proof = await verifyCheckoutTransfer({
    txHash: hash,
    sender: payer,
    recipient: request.recipientAddress,
    amount: request.amount.toFixed(),
  });
  const settlementKey = `${CHAIN_ID}:${hash}`;
  const eligible = {
    id: request.id,
    status: {
      in: ["PENDING", "PROCESSING", "EXPIRED"] as (
        | "PENDING"
        | "PROCESSING"
        | "EXPIRED"
      )[],
    },
    OR: [{ txHash: null }, { txHash: hash }],
  };
  if (!proof.valid && proof.reverted) {
    await prisma.paymentRequest.updateMany({
      where: {
        id: request.id,
        status: "PROCESSING",
        txHash: hash,
        payerAddress: payer,
      },
      data: {
        status:
          request.expiresAt && request.expiresAt <= new Date()
            ? "EXPIRED"
            : "PENDING",
        txHash: null,
        settlementKey: null,
        payerAddress: null,
      },
    });
    throw new RevertedCheckoutError();
  }
  if (!proof.valid && !proof.pending) throw new HttpError(proof.reason, 422);
  if (!proof.valid && !proof.verifiedIntent) return { request, pending: true };
  if (
    proof.valid &&
    proof.timestamp < BigInt(Math.floor(request.createdAt.getTime() / 1000))
  )
    throw new HttpError("That transfer predates this request.", 422);

  try {
    return await prisma.$transaction(async (tx) => {
      const paidAt = proof.valid
        ? new Date(Number(proof.timestamp) * 1000)
        : null;
      const status = paidAt
        ? request.expiresAt && paidAt > request.expiresAt
          ? "LATE_PAID"
          : "PAID"
        : "PROCESSING";
      const changed = await tx.paymentRequest.updateMany({
        where: eligible,
        data: {
          status,
          txHash: hash,
          settlementKey,
          payerAddress: payer,
          paidAt,
        },
      });
      const current = await tx.paymentRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
      if (!changed.count) {
        if (
          current.txHash === hash &&
          current.payerAddress === payer &&
          ["PAID", "LATE_PAID"].includes(current.status)
        )
          return { request: current, pending: false };
        throw new HttpError(
          "The request changed while confirming. Refresh before continuing.",
          409,
        );
      }
      if (proof.valid && paidAt) {
        const sender = await tx.user.findUnique({
          where: { walletAddress: payer },
          select: { id: true },
        });
        if (!sender)
          throw new HttpError(
            "Sign in to Pocket before recording this payment.",
            409,
          );
        const recipient = await tx.user.findUnique({
          where: { walletAddress: request.recipientAddress },
          select: { id: true },
        });
        const existing = await tx.payment.findUnique({
          where: { paymentId: hash },
        });
        if (
          existing &&
          (existing.senderId !== sender.id ||
            existing.recipientAddress !== request.recipientAddress ||
            !existing.amount.equals(request.amount) ||
            existing.mode !== "DIRECT" ||
            existing.chainId !== CHAIN_ID ||
            existing.token !== request.token)
        )
          throw new HttpError(
            "That transaction belongs to a different payment record.",
            409,
          );
        const data = {
          mode: "DIRECT" as const,
          chainId: CHAIN_ID,
          token: request.token,
          senderId: sender.id,
          recipientId: recipient?.id ?? null,
          recipientAddress: request.recipientAddress,
          amount: request.amount,
          note: request.description,
          destChain: "MEZO" as const,
          status: "PAID" as const,
          payoutTxHash: hash,
          paidAt,
        };
        await tx.payment.upsert({
          where: { paymentId: hash },
          create: { paymentId: hash, ...data },
          update: data,
        });
      }
      return { request: current, pending: !proof.valid };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new HttpError(
        "This transaction is already assigned to another request.",
        409,
      );
    throw error;
  }
}
