import type { NextRequest } from "next/server";
import { after } from "next/server";
import {
  requireIdentity,
  errorResponse,
  AuthError,
  HttpError,
} from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { verifyBorrowWrite, type BorrowWriteKind } from "@/lib/mezo/verify";
import {
  formatBtc,
  formatUsd,
} from "@/lib/mezo/borrow-format";
import { explorer } from "@/lib/mezo/explorer";
import { sendReceipt } from "@/lib/email/send";
import type { ReceiptDetail, ReceiptEmailInput } from "@/lib/email/receipt";

/**
 * Record a Mezo Borrow write the user's own wallet already made.
 *
 * POST /api/borrow/record { txHash }
 *
 * Borrow is the one money action in Pocket with no server step. The app reads
 * the Trove, quotes the fee, and the wallet signs `openTrove` / `repayMUSD` /
 * `closeTrove` directly against Mezo's BorrowerOperations contract. Nothing of
 * Pocket's is touched, and nothing in Pocket's tables changes: this route does
 * not file a row, because a loan is not a payment and the activity feed is not
 * a ledger of debt. It exists for one reason — a receipt is owed, and only the
 * server can be trusted to say what happened.
 *
 * It takes almost nothing on faith. `verifyBorrowWrite` reads the receipt and
 * the transaction and decodes the calldata against the Borrow ABI, so the
 * claim "I borrowed" is only honoured when the chain shows a successful call
 * to the right contract, from the caller's own wallet, with a function this
 * app can produce. The amounts in the receipt come from that calldata, not
 * from the request.
 *
 * Verification happens *after* broadcast, so it never gates the write — the
 * money has already moved. A failure here means a missing email, not a failed
 * loan, and the client does not surface it as one.
 *
 * There is no dedupe table: the client fires this once per broadcast, and a
 * retried call would send a second identical receipt. That is a better failure
 * than persisting loan events in a schema that has no business holding them
 * yet.
 */

/** Per-kind wording that the template itself has no way to know. */
const DETAILS: Record<
  BorrowWriteKind,
  { label: string }
> = {
  borrow: { label: "Borrowing into" },
  repay: { label: "Repaying from" },
  close: { label: "Borrower" },
};

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const txHash =
      typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
      throw new HttpError("A transaction hash is required", 400);
    }

    const verdict = await verifyBorrowWrite({
      txHash: txHash as `0x${string}`,
      wallet: user.walletAddress,
    });

    if (!verdict.valid) {
      if (!verdict.pending) {
        // The chain disagrees with the claim; the verifier already says how.
        throw new HttpError(verdict.reason, 422);
      }
      /*
        Broadcast but not yet mined, or the RPC has not caught up. There is no
        row to leave pending — nothing is filed — so the honest answer is that
        the receipt is not ready. The client treats this as done, because the
        write itself is done; only the email is missing.
      */
      return Response.json({ ok: true, pending: true }, { status: 202 });
    }

    const receiptsEmail = user.receiptsEmail;
    if (!receiptsEmail) {
      return Response.json({ ok: true, kind: verdict.kind, mailed: false });
    }

    const details: ReceiptDetail[] = [
      { label: DETAILS[verdict.kind].label, value: `@${user.username}` },
    ];

    if (verdict.kind === "borrow" && verdict.collateral !== null) {
      details.push({
        label: "Collateral",
        value: `${formatBtc(verdict.collateral)} BTC`,
      });
    }

    const input: ReceiptEmailInput = {
      kind: verdict.kind,
      amount: verdict.amount === null ? null : formatUsd(verdict.amount),
      counterparty: "Mezo Borrow",
      details,
      status: "confirmed",
      at: new Date(),
      reference: txHash,
      explorerUrl: explorer.tx(txHash),
      appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://mpocket.tech",
      network: "Mezo",
    };

    const to = receiptsEmail;
    after(async () => {
      await sendReceipt(to, input);
    });

    return Response.json({ ok: true, kind: verdict.kind, mailed: true });
  } catch (e) {
    return errorResponse(e);
  }
}
