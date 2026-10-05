import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { Prisma } from "@prisma/client";
import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet, getUserByUsername } from "@/lib/users/service";
import { MUSD_ADDRESS } from "@/lib/mezo/config";
import { normalizeAddress } from "@/lib/mezo/musd";
import {
  freezeForSend,
  releaseFrozen,
  refundToAvailable,
  ledgerTx,
} from "@/lib/ledger/service";
import {
  vaultPayout,
  settlementEngineReady,
  PayoutUnconfirmedError,
} from "@/lib/settlement/engine";
import { validateAmount } from "@/lib/validate";
import { newPaymentId, paymentIdFromKey } from "@/lib/payment-id";
import { prisma } from "@/lib/db";

/**
 * Payments (Send) — "Send MUSD. Pocket handles the chain."
 *
 * GET  /api/payments — the caller's sent + received payments.
 * POST /api/payments { amount, recipient, note?, destChain? } — send MUSD to a
 *   @username or a raw address. The sender's ledger freezes the amount, the vault
 *   makes a real instant payout to the recipient's wallet on Mezo testnet, then
 *   the frozen funds are released (they've left the vault). The recipient receives
 *   REAL MUSD in their wallet, so we do NOT also credit their ledger — that would
 *   double-count; a Pocket recipient just gets a RECEIVE row in their Activity.
 *
 * Phase B wires the real Mezo leg only (destChain = MEZO). Base/Ethereum routing
 * + simulated payout + net settlement arrive in Phase C.
 */

export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const payments = await prisma.payment.findMany({
      where: { OR: [{ senderId: user.id }, { recipientId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sender: { select: { username: true } },
        recipient: { select: { username: true } },
      },
    });

    return Response.json({
      payments: payments.map((p) => ({
        id: p.id,
        paymentId: p.paymentId,
        direction: p.senderId === user.id ? "sent" : "received",
        amount: p.amount.toString(),
        note: p.note,
        destChain: p.destChain,
        status: p.status,
        payoutTxHash: p.payoutTxHash,
        counterparty:
          p.senderId === user.id
            ? p.recipient?.username
              ? `@${p.recipient.username}`
              : p.recipientAddress
            : `@${p.sender.username}`,
        createdAt: p.createdAt.toISOString(),
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
        { error: "Sending is not available (settlement engine offline)" },
        { status: 503 },
      );
    }
    const sender = await getUserByWallet(identity.walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const amount = validateAmount(body.amount);
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 140)
        : null;

    const destChain = typeof body.destChain === "string" ? body.destChain : "MEZO";
    if (destChain !== "MEZO") {
      throw new HttpError("Cross-chain sends arrive in the next phase", 400);
    }

    // Resolve the recipient → a wallet to pay out to, plus a Pocket user id if any.
    const rawRecipient =
      typeof body.recipient === "string" ? body.recipient.trim() : "";
    if (!rawRecipient) throw new HttpError("Choose who to pay");

    let recipientId: string | null = null;
    let recipientWallet: string;
    let counterpartyLabel: string;

    if (isAddress(rawRecipient)) {
      recipientWallet = normalizeAddress(rawRecipient);
      counterpartyLabel = rawRecipient;
      const pocketUser = await getUserByWallet(recipientWallet);
      recipientId = pocketUser?.id ?? null;
    } else {
      const username = rawRecipient.replace(/^@/, "").toLowerCase();
      const pocketUser = await getUserByUsername(username);
      if (!pocketUser) throw new HttpError(`No Pocket user @${username}`, 404);
      recipientId = pocketUser.id;
      recipientWallet = pocketUser.walletAddress;
      counterpartyLabel = `@${pocketUser.username}`;
    }

    if (recipientId === sender.id) {
      throw new HttpError("You can't send to yourself");
    }

    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    const paymentId = idempotencyKey
      ? paymentIdFromKey(idempotencyKey, "payment")
      : newPaymentId();
    const token = MUSD_ADDRESS.toLowerCase();

    // 1. Commit the funds: freeze (guarded) + record the pending payment atomically.
    //    A retried idempotency key collides on Payment.paymentId (@unique); the whole
    //    tx — the freeze included — rolls back, so a retry never double-freezes. We
    //    turn that collision into an idempotent reply instead of a raw 500.
    const commit = await (async () => {
      try {
        return await ledgerTx(async (tx) => {
          await freezeForSend(tx, sender.id, amount); // throws LedgerError (→400) if short
          const payment = await tx.payment.create({
            data: {
              paymentId,
              senderId: sender.id,
              recipientId,
              recipientAddress: recipientId ? null : recipientWallet.toLowerCase(),
              amount,
              note,
              destChain: "MEZO",
              status: "PENDING",
            },
          });
          const txRow = await tx.transaction.create({
            data: {
              type: "SEND",
              userId: sender.id,
              counterparty: counterpartyLabel,
              amount,
              token,
              sourceChain: "MEZO",
              destChain: "MEZO",
              status: "PROCESSING",
              paymentId,
              note,
            },
          });
          return { payment, txRow };
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const existing = await prisma.payment.findUnique({ where: { paymentId } });
          if (existing && (existing.status === "PAID" || existing.status === "SETTLED")) {
            return Response.json({
              ok: true,
              paymentId,
              txHash: existing.payoutTxHash,
              amount: existing.amount.toString(),
              counterparty: counterpartyLabel,
              idempotent: true,
            });
          }
          throw new HttpError(
            "A payment with this key is already in progress — check Activity before retrying.",
            409,
          );
        }
        throw e;
      }
    })();
    if (commit instanceof Response) return commit;
    const { payment, txRow } = commit;

    // 2. Real instant payout from the vault — `vaultPayout` now waits for the receipt.
    //    A plain throw => the release failed and nothing moved (safe to refund). A
    //    PayoutUnconfirmedError => it may have moved, so we NEVER refund: persist the
    //    hash, leave the funds frozen, and ask the user to wait for reconciliation.
    let hash: `0x${string}`;
    try {
      ({ hash } = await vaultPayout(recipientWallet, amount, paymentId));
    } catch (err) {
      if (err instanceof PayoutUnconfirmedError) {
        await ledgerTx(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { payoutTxHash: err.hash },
          });
          await tx.transaction.update({
            where: { id: txRow.id },
            data: { txHash: err.hash },
          });
        });
        throw new HttpError(
          "Payment was broadcast but not yet confirmed — it'll reconcile shortly. Don't retry.",
          504,
        );
      }
      // Definite failure (pre-broadcast or reverted) — the refund is safe.
      await ledgerTx(async (tx) => {
        await refundToAvailable(tx, sender.id, amount);
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        await tx.transaction.update({ where: { id: txRow.id }, data: { status: "FAILED" } });
      });
      throw new HttpError(
        `Payout failed on-chain: ${err instanceof Error ? err.message : "unknown error"}`,
        502,
      );
    }

    // 3. Payout CONFIRMED — money has left the vault. Finalize the ledger. This path
    //    NEVER refunds: on a DB failure we keep funds committed, persist the hash, and
    //    still report success — a reconciler squares the frozen balance later.
    try {
      await ledgerTx(async (tx) => {
        await releaseFrozen(tx, sender.id, amount);
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", payoutTxHash: hash, paidAt: new Date() },
        });
        await tx.transaction.update({
          where: { id: txRow.id },
          data: { status: "COMPLETED", txHash: hash },
        });
        if (recipientId) {
          await tx.transaction.create({
            data: {
              type: "RECEIVE",
              userId: recipientId,
              counterparty: `@${sender.username}`,
              amount,
              token,
              sourceChain: "MEZO",
              destChain: "MEZO",
              status: "COMPLETED",
              paymentId,
              txHash: hash,
              note,
            },
          });
        }
      });
    } catch (finalizeErr) {
      console.error("[payments] finalize failed after confirmed payout", { paymentId, hash, error: finalizeErr });
      await prisma.payment
        .update({ where: { id: payment.id }, data: { payoutTxHash: hash } })
        .catch(() => {});
      return Response.json({
        ok: true,
        paymentId,
        txHash: hash,
        amount,
        counterparty: counterpartyLabel,
        warning: "Payout delivered; your balance will reconcile shortly.",
      });
    }

    return Response.json({
      ok: true,
      paymentId,
      txHash: hash,
      amount,
      counterparty: counterpartyLabel,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
