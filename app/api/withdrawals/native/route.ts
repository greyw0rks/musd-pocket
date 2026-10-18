import type { NextRequest } from "next/server";
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
import { verifyBtcTransfer } from "@/lib/mezo/verify";
import { formatBtc } from "@/lib/mezo/borrow-format";
import { prisma } from "@/lib/db";

/**
 * Record a native BTC transfer the user's own wallet already made.
 *
 * POST /api/withdrawals/native { txHash, toAddress, amount }
 *
 * A sibling of `/api/payments/record`, for the other token. Both routes exist
 * for the same reason and hold the same line: the money has already moved by
 * the time either is called, so this is bookkeeping — it files the row that
 * makes the transfer appear in Spending. A failure here is a gap in the
 * history, not a failed transfer, and the client treats it that way.
 *
 * It exists at all because Pocket's ledger has no part in a BTC transfer: the
 * user's wallet signs it, the chain's gas token pays for it, and nothing of
 * Pocket's is debited. That is precisely why the row has to be filed honestly —
 * a BTC amount written into a MUSD-shaped row would render as dollars, and the
 * table is shared, so `asset` is what tells the two apart.
 *
 * It does not take the client's word for anything. `verifyBtcTransfer` reads
 * the receipt *and the transaction* (a native transfer emits no log to read)
 * and checks that it went to the claimed address for the claimed amount, from
 * the caller's own wallet. A route that files rows into a user's Spending on
 * request is a route anyone could use to write themselves a transfer that never
 * happened, so an unverifiable claim is refused rather than filed.
 *
 * Verification happens *after* broadcast, so it never gates the transfer — it
 * only decides whether the row is filed as completed, filed as pending, or
 * refused.
 *
 * `paymentId` holds the transaction hash. For a vault release it is the bytes32
 * tag the `withdraw` was called with; a BTC transfer has no such tag, and the
 * field is the table's only unique index — already a bytes32, already unique,
 * already known to both sides. That is what makes a retry the same row rather
 * than a second one, exactly as it does in `Payment`.
 */

/** The stored amount, at the precision the token is read at. See below. */
function storedAmount(amountWei: bigint): string {
  /*
    Display precision, like every other amount in this table: BTC to eight
    places. The activity reader parses the column with `parseBtc`, which refuses
    a ninth decimal rather than truncating it, so a full 18-decimal value would
    read back as *zero* — a real transfer, silently filed as nothing. The user
    typed at most eight places, so nothing is lost by storing eight.
  */
  return formatBtc(amountWei);
}

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

    const toAddress = typeof body.toAddress === "string" ? body.toAddress.trim() : "";
    if (!isAddress(toAddress)) {
      throw new HttpError("A recipient address is required", 400);
    }
    const recipient = normalizeAddress(toAddress).toLowerCase();

    const amount = typeof body.amount === "string" ? body.amount.trim() : "";
    if (!amount) throw new HttpError("An amount is required", 400);

    /*
      Idempotent: a retried call is the same transfer, so it returns the row
      that already exists instead of writing a second one.
    */
    const existing = await prisma.withdrawal.findUnique({
      where: { paymentId: txHash },
    });
    if (existing) {
      /*
        A row that never reached a verdict is retried rather than returned.

        The first attempt filed `PENDING` because the receipt could not be read
        yet — that is the honest state, and it is also a state nothing else ever
        leaves. No reconciler touches a BTC row (it would reverse a debit that
        does not exist), so this retry is the only thing that can promote it.
        Best-effort: a second unreadable receipt changes nothing, and a refused
        claim stays pending rather than being rewritten to failed, because a
        transfer that happened must not be erased by a later bad read.
      */
      if (existing.status !== "COMPLETED") {
        const retry = await verifyBtcTransfer({
          txHash: txHash as `0x${string}`,
          recipient,
          amount: existing.amount.toString(),
        });
        if (retry.valid && retry.from.toLowerCase() === sender.walletAddress.toLowerCase()) {
          const promoted = await prisma.withdrawal.update({
            where: { id: existing.id },
            data: { status: "COMPLETED" },
          });
          return Response.json({
            ok: true,
            id: promoted.id,
            status: promoted.status,
            idempotent: true,
          });
        }
      }
      return Response.json({
        ok: true,
        id: existing.id,
        status: existing.status,
        idempotent: true,
      });
    }

    /*
      File the row, and treat a lost race as the retry it is. The lookup above
      cannot answer the concurrent case: two calls in flight both miss, and both
      create. The unique index on `paymentId` is what actually makes this
      idempotent, so the losing call reads back the winner's row rather than
      failing a request whose money has already moved.
    */
    async function file(data: Prisma.WithdrawalUncheckedCreateInput) {
      try {
        return await prisma.withdrawal.create({ data });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const row = await prisma.withdrawal.findUnique({
            where: { paymentId: txHash },
          });
          if (row) return row;
        }
        throw e;
      }
    }

    const verdict = await verifyBtcTransfer({
      txHash: txHash as `0x${string}`,
      recipient,
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
        transfer that happened and appears nowhere. A later retry promotes it.
      */
      const row = await file({
        userId: sender.id,
        chain: "MEZO",
        asset: "BTC",
        toAddress: recipient,
        amount,
        status: "PENDING",
        txHash,
        paymentId: txHash,
      });
      return Response.json({ ok: true, id: row.id, status: row.status });
    }

    // Verified: the caller's wallet really sent this amount to this address.
    if (verdict.from.toLowerCase() !== sender.walletAddress.toLowerCase()) {
      throw new HttpError("That transfer was not sent from your wallet", 403);
    }

    const row = await file({
      userId: sender.id,
      chain: "MEZO",
      asset: "BTC",
      toAddress: recipient,
      amount: storedAmount(verdict.value),
      status: "COMPLETED",
      txHash,
      paymentId: txHash,
    });

    /*
      No `Transaction` row, for the same reason `/api/payments/record` writes
      none: nothing in the app reads that table — Activity is served from
      `Payment` and `Withdrawal` — so a row here would be a record nobody can
      see, describing a transfer already recorded above.
    */

    return Response.json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
    return errorResponse(e);
  }
}
