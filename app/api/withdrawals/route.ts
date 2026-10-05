import type { NextRequest } from "next/server";
import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { MUSD_ADDRESS } from "@/lib/mezo/config";
import { debitAvailable, creditAvailable, ledgerTx } from "@/lib/ledger/service";
import {
  vaultWithdraw,
  settlementEngineReady,
  PayoutUnconfirmedError,
} from "@/lib/settlement/engine";
import { validateAmount, validateAddress } from "@/lib/validate";
import { newPaymentId, paymentIdFromKey } from "@/lib/payment-id";
import { prisma } from "@/lib/db";

/**
 * Withdrawals — cash out Pocket balance to an external address. Real MUSD leaves
 * the vault on Mezo testnet; Pocket (the relayer) pays the BTC gas.
 *
 * GET  /api/withdrawals — the caller's withdrawal history.
 * POST /api/withdrawals { amount, toAddress, idempotencyKey? } — debit the ledger,
 *   then release from the vault. Funds are reserved (debited) BEFORE the on-chain
 *   call. We refund ONLY when the release definitively fails (never confirmed /
 *   reverted) — once the receipt confirms, the money is gone and we never refund.
 */

export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json({
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        chain: w.chain,
        toAddress: w.toAddress,
        txHash: w.txHash,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    if (!settlementEngineReady()) {
      return Response.json(
        { error: "Withdrawals are not available (settlement engine offline)" },
        { status: 503 },
      );
    }
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const amount = validateAmount(body.amount);
    const toAddress = validateAddress(body.toAddress);
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    // A stable key → a stable bytes32 paymentId → the vault's on-chain `processed`
    // guard reverts a duplicate withdraw, so a retry can't release funds twice.
    const paymentId = idempotencyKey
      ? paymentIdFromKey(idempotencyKey, "withdrawal")
      : newPaymentId();
    const token = MUSD_ADDRESS.toLowerCase();

    // 1. Reserve the funds: debit (guarded) + record the pending rows atomically.
    const { withdrawal, txRow } = await ledgerTx(async (tx) => {
      await debitAvailable(tx, user.id, amount); // throws LedgerError (→400) if short
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: user.id,
          chain: "MEZO",
          toAddress: toAddress.toLowerCase(),
          amount,
          status: "PROCESSING",
        },
      });
      const txRow = await tx.transaction.create({
        data: {
          type: "WITHDRAW",
          userId: user.id,
          counterparty: toAddress,
          amount,
          token,
          sourceChain: "MEZO",
          destChain: "MEZO",
          status: "PROCESSING",
          paymentId,
        },
      });
      return { withdrawal, txRow };
    });

    // 2. Real on-chain release from the vault — `vaultWithdraw` waits for the receipt.
    //    A plain throw => nothing moved (safe to refund). PayoutUnconfirmedError =>
    //    the funds may have moved, so NEVER refund: persist the hash and reconcile.
    let hash: `0x${string}`;
    try {
      ({ hash } = await vaultWithdraw(toAddress, amount, paymentId));
    } catch (err) {
      if (err instanceof PayoutUnconfirmedError) {
        await prisma.$transaction([
          prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { txHash: err.hash } }),
          prisma.transaction.update({ where: { id: txRow.id }, data: { txHash: err.hash } }),
        ]);
        throw new HttpError(
          "Withdrawal was broadcast but not yet confirmed — it'll reconcile shortly. Don't retry.",
          504,
        );
      }
      // Definite failure — refund the debit and mark the attempt failed.
      await ledgerTx(async (tx) => {
        await creditAvailable(tx, user.id, amount);
        await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "FAILED" } });
        await tx.transaction.update({ where: { id: txRow.id }, data: { status: "FAILED" } });
      });
      throw new HttpError(
        `Withdrawal failed on-chain: ${err instanceof Error ? err.message : "unknown error"}`,
        502,
      );
    }

    // 3. Withdrawal CONFIRMED — funds left the vault. Mark COMPLETED. This never
    //    refunds: on a DB failure we still report success — the money is already out.
    try {
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: { txHash: hash, status: "COMPLETED" },
        }),
        prisma.transaction.update({
          where: { id: txRow.id },
          data: { txHash: hash, status: "COMPLETED" },
        }),
      ]);
    } catch (finalizeErr) {
      console.error("[withdrawals] finalize failed after confirmed withdraw", { paymentId, hash, error: finalizeErr });
      return Response.json({
        ok: true,
        txHash: hash,
        amount,
        warning: "Withdrawal delivered; your history will update shortly.",
      });
    }

    return Response.json({ ok: true, txHash: hash, amount });
  } catch (e) {
    return errorResponse(e);
  }
}
