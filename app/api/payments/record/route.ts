import type { NextRequest } from "next/server";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { isAddress } from "viem";
import {
  requireIdentity,
  errorResponse,
  AuthError,
  HttpError,
} from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { normalizeAddress } from "@/lib/mezo/musd";
import { verifyMusdPayment } from "@/lib/mezo/verify";
import { explorer } from "@/lib/mezo/explorer";
import { toDisplayUnits, unitsToDecimal } from "@/features/payments/amount";
import { formatMoney } from "@/lib/formatters";
import { sendReceipt } from "@/lib/email/send";
import { shortenAddress } from "@/lib/utils";
import { prisma } from "@/lib/db";

/**
 * Record a mUSD transfer the user's own wallet already made.
 *
 * POST /api/payments/record { txHash, recipient, amount }
 *
 * This route does not move money and holds none. By the time it is called the
 * transfer is on-chain — the client signed it and holds the receipt — so this
 * is bookkeeping: it files the row that makes the payment appear in Activity.
 * A failure here is a gap in the history, not a failed payment, and the client
 * treats it that way.
 *
 * It does not take the client's word for it either. `verifyMusdPayment` reads
 * the receipt and checks the token contract, the recipient, the exact amount,
 * and that the transfer came from the caller's own wallet — because a route
 * that files rows into a user's Activity on request is a route anyone could use
 * to write themselves a payment that never happened. An unverifiable claim is
 * refused rather than filed.
 *
 * Verification happens *after* broadcast, so it never gates the send — it only
 * decides whether the row is filed as paid, filed as pending, or refused.
 *
 * `paymentId` is the transaction hash: it is already a bytes32, already unique,
 * and already known to both sides, which makes a retry the same row rather than
 * a second one.
 */

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const sender = await getUserByWallet(identity.walletAddress);
    if (!sender) throw new AuthError("User not found — sync first", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const txHash =
      typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
      throw new HttpError("A transaction hash is required", 400);
    }

    const recipient = typeof body.recipient === "string" ? body.recipient.trim() : "";
    if (!isAddress(recipient)) {
      throw new HttpError("A recipient address is required", 400);
    }
    const toAddress = normalizeAddress(recipient).toLowerCase();

    const amount = typeof body.amount === "string" ? body.amount.trim() : "";
    if (!amount) throw new HttpError("An amount is required", 400);

    // Idempotent: a retried call is the same transfer, so it returns the row
    // that already exists instead of trying to write a second one. This is the
    // cheap path — it also skips the verification below, which matters on a
    // retry because a receipt that old may no longer be served by the RPC.
    const existing = await prisma.payment.findUnique({
      where: { paymentId: txHash },
    });
    if (existing) {
      return Response.json({
        ok: true,
        id: existing.id,
        status: existing.status,
        idempotent: true,
      });
    }

    /*
      File the row, and treat a lost race as the retry it is.

      The lookup above cannot answer the concurrent case: two calls in flight
      both miss, and both create. The unique index on `paymentId` is what
      actually makes this idempotent, so the losing call reads back the winner's
      row rather than failing a request whose money has already moved. Mirrors
      the `P2002` handling in `app/api/payments/route.ts`.
    */
    async function file(data: Prisma.PaymentUncheckedCreateInput) {
      try {
        return await prisma.payment.create({ data });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const row = await prisma.payment.findUnique({ where: { paymentId: txHash } });
          if (row) return row;
        }
        throw e;
      }
    }

    const verdict = await verifyMusdPayment({
      txHash: txHash as `0x${string}`,
      recipient: toAddress,
      amount,
    });

    if (!verdict.valid) {
      if (!verdict.pending) {
        // The chain disagrees with the claim. Nothing is filed, and the reason
        // is the verifier's — it already names what did not match.
        throw new HttpError(verdict.reason, 422);
      }
      /*
        Broadcast but not yet mined, or the RPC has not caught up. `pending` is
        the honest state and the one the UI already knows how to draw, so the
        row is filed unconfirmed rather than held back — the alternative is a
        payment that happened and appears nowhere.
      */
      const row = await file({
        paymentId: txHash,
        senderId: sender.id,
        recipientAddress: toAddress,
        amount,
        destChain: "MEZO",
        status: "PENDING",
        payoutTxHash: txHash,
      });
      return Response.json({ ok: true, id: row.id, status: row.status });
    }

    // Verified: the caller's wallet really sent this amount to this address.
    if (verdict.from.toLowerCase() !== sender.walletAddress.toLowerCase()) {
      throw new HttpError("That transfer was not sent from your wallet", 403);
    }

    /*
      Stored at display precision, like every other amount in this table: the
      activity reader parses amounts with `parseDecimalToUnits`, which rejects
      more than two decimals, so an 18-decimal row would silently read back as
      zero. The user typed a two-decimal amount, so nothing is lost here.
    */
    const storedAmount = unitsToDecimal(toDisplayUnits(verdict.value));

    const recipientUser = await prisma.user.findUnique({
      where: { walletAddress: toAddress },
      select: { id: true, username: true, receiptsEmail: true },
    });

    const row = await file({
      paymentId: txHash,
      senderId: sender.id,
      recipientId: recipientUser?.id ?? null,
      recipientAddress: recipientUser ? null : toAddress,
      amount: storedAmount,
      destChain: "MEZO",
      status: "PAID",
      payoutTxHash: txHash,
      paidAt: new Date(),
    });

    /*
      No `Transaction` row is written. Its only purpose elsewhere is the flat
      activity feed, and nothing in the app reads that table — Activity is
      served from `Payment` and `Withdrawal` — so a row here would be a record
      nobody can see, describing a payment already recorded above.
    */

    /*
      Two receipts leave this route, not one: the payer's "Sent!" and the
      recipient's "Received!". They are separate documents about the same
      transaction, addressed to different people, each sent only to an address
      that person attached themselves. A self-transfer sends one — the sender's
      — because two copies of the same event in one inbox is noise, not a
      record.

      The receipt is mailed after the response is finished, and nothing on the
      payment path awaits it. The money has already moved by the time this route
      runs, so a mailbox provider having a bad minute must not turn a completed
      transfer into a failed one.

      `after` rather than a bare floating promise: on a serverless platform the
      function can be frozen the moment the response is returned, which would
      silently drop a fire-and-forget send. `after` is the runtime's promise to
      keep the invocation alive until the callback settles, and the send itself
      has a 10s timeout.

      `row.status === "PAID"` rather than an assumption: if two calls raced and
      this one lost, `file()` returns the winner's row, which may still be the
      pending copy. A "Sent!" email for a transfer the database calls pending
      would be a receipt for a state that did not exist.
    */
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://mpocket.tech";
    const displayAmount = formatMoney(toDisplayUnits(verdict.value));
    const senderHandle = `@${sender.username}`;
    const recipientHandle = recipientUser
      ? `@${recipientUser.username}`
      : shortenAddress(toAddress);
    const at = row.paidAt ?? new Date();

    const senderReceiptsEmail = sender.receiptsEmail;
    if (senderReceiptsEmail && row.status === "PAID") {
      after(async () => {
        await sendReceipt(senderReceiptsEmail, {
          kind: "sent",
          amount: displayAmount,
          counterparty: recipientHandle,
          counterpartyAddress: toAddress,
          details: [{ label: "From", value: senderHandle }],
          status: "confirmed",
          at,
          reference: txHash,
          explorerUrl: explorer.tx(txHash),
          appUrl,
          network: "Mezo",
        });
      });
    }

    const recipientReceiptsEmail = recipientUser?.receiptsEmail ?? null;
    const recipientId = recipientUser?.id ?? null;
    if (
      recipientReceiptsEmail &&
      recipientId !== null &&
      recipientId !== sender.id &&
      row.status === "PAID"
    ) {
      const recipientName = recipientHandle;
      const receivedFrom = senderHandle;
      after(async () => {
        await sendReceipt(recipientReceiptsEmail, {
          kind: "received",
          amount: displayAmount,
          counterparty: receivedFrom,
          counterpartyAddress: sender.walletAddress,
          details: [{ label: "To", value: recipientName }],
          status: "confirmed",
          at,
          reference: txHash,
          explorerUrl: explorer.tx(txHash),
          appUrl,
          network: "Mezo",
        });
      });
    }

    return Response.json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
    return errorResponse(e);
  }
}
