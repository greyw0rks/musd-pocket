import "server-only";
import { customAlphabet } from "nanoid";
import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";
import { toStorageAddress } from "@/lib/utils";
import { paymentAmount } from "@/lib/payments/amount";
import { HttpError } from "@/lib/auth/request";
import { verifyMusdPayment } from "@/lib/mezo/verify";
import { recordDirectPayment } from "@/lib/payments/direct";
import type { Hash } from "viem";

// 130 bits of entropy; legacy five-character IDs retain their authentication gate.
const makeShortId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 26);
export const isPublicRequestId = (id: string) => /^[A-HJ-NP-Z2-9]{26}$/.test(id);
export const displayId = (shortId: string) => `POCKET-${shortId}`;

export async function createPaymentRequest(input: {
  creatorAddress: string; intendedPayerAddress?: string | null; merchantName?: string | null;
  amount: string; description?: string | null; expiresInHours?: number | null;
}) {
  const creator = toStorageAddress(input.creatorAddress);
  if (input.intendedPayerAddress?.toLowerCase() === creator) throw new HttpError("You cannot request a payment from yourself.");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.paymentRequest.create({ data: {
        shortId: makeShortId(), creatorAddress: creator, recipientAddress: creator,
        intendedPayerAddress: input.intendedPayerAddress ? toStorageAddress(input.intendedPayerAddress) : null,
        merchantName: input.merchantName ?? null, amount: paymentAmount(input.amount),
        token: toStorageAddress(MUSD_ADDRESS), chainId: CHAIN_ID,
        description: input.description?.trim() || null,
        expiresAt: input.expiresInHours ? new Date(Date.now() + input.expiresInHours * 3_600_000) : null,
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new HttpError("Could not create a unique payment link. Try again.", 503);
}

export async function getByShortId(shortId: string) {
  const where = { shortId: shortId.toUpperCase() };
  let row = await prisma.paymentRequest.findUnique({ where });
  if (row?.status === "PENDING" && row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await prisma.paymentRequest.updateMany({ where: { id: row.id, status: "PENDING", version: row.version }, data: { status: "EXPIRED", version: { increment: 1 } } });
    row = await prisma.paymentRequest.findUnique({ where });
  }
  return row;
}

export async function listByCreator(creatorAddress: string, status?: RequestStatus) {
  await reconcileRequestPayments({ creatorAddress });
  await expireRequests();
  return prisma.paymentRequest.findMany({ where: { creatorAddress: toStorageAddress(creatorAddress), ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listForWallet(wallet: string, status?: RequestStatus) {
  const address = toStorageAddress(wallet);
  await reconcileRequestPayments({ wallet: address });
  await expireRequests();
  return prisma.paymentRequest.findMany({ where: { OR: [{ creatorAddress: address }, { intendedPayerAddress: address }], ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
}

async function expireRequests() {
  await prisma.paymentRequest.updateMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED", version: { increment: 1 } } });
}

/** Recover only previously authenticated, chain-verified pending intents. */
export async function reconcileRequestPayments(filter: { creatorAddress?: string; wallet?: string; shortId?: string } = {}, limit = 5) {
  const rows = await prisma.paymentRequest.findMany({ where: {
    status: "PROCESSING", txHash: { not: null }, payerAddress: { not: null },
    ...(filter.creatorAddress ? { creatorAddress: filter.creatorAddress.toLowerCase() } : {}),
    ...(filter.wallet ? { OR: [{ creatorAddress: filter.wallet.toLowerCase() }, { payerAddress: filter.wallet.toLowerCase() }] } : {}),
    ...(filter.shortId ? { shortId: filter.shortId.toUpperCase() } : {}),
  }, take: Math.min(Math.max(limit, 1), 25), orderBy: { createdAt: "asc" } });
  const report = { scanned: rows.length, finalized: 0, held: 0 };
  await Promise.all(rows.map(async row => {
    try {
      const sender = await prisma.user.findUnique({ where: { walletAddress: row.payerAddress! }, select: { id: true, walletAddress: true } });
      if (!sender) { report.held++; return; }
      const result = await confirmRequestPayment(row.shortId, row.txHash as Hash, sender);
      if (result.pending) report.held++; else report.finalized++;
    } catch { report.held++; }
  }));
  return report;
}

export function assertRequestPayer(row: { creatorAddress: string; intendedPayerAddress: string | null; chainId: number; token: string }, wallet: string) {
  const payer = wallet.toLowerCase();
  if (row.chainId !== CHAIN_ID || row.token.toLowerCase() !== MUSD_ADDRESS.toLowerCase()) throw new HttpError("This request is for a different network.", 409);
  if (row.creatorAddress.toLowerCase() === payer) throw new HttpError("You cannot pay your own request.", 403);
  if (row.intendedPayerAddress && row.intendedPayerAddress.toLowerCase() !== payer) throw new HttpError("This request is addressed to another wallet.", 403);
}

export async function confirmRequestPayment(shortId: string, txHash: Hash, sender: { id: string; walletAddress: string }) {
  const row = await getByShortId(shortId);
  if (!row) throw new HttpError("Request not found.", 404);
  assertRequestPayer(row, sender.walletAddress);
  const hash = txHash.toLowerCase() as Hash;
  if (row.status === "PAID" || row.status === "LATE_PAID") {
    if (row.txHash?.toLowerCase() === hash && row.payerAddress === sender.walletAddress.toLowerCase()) return { request: row, pending: false };
    throw new HttpError("This invoice already has a different payment. If you sent another transfer, contact the merchant with its transaction hash.", 409);
  }
  const proof = await verifyMusdPayment({ txHash: hash, recipient: row.recipientAddress, amount: row.amount.toString(), sender: sender.walletAddress });
  if (!proof.valid) {
    if (!proof.pending) {
      if (proof.reason === "Transaction reverted" && row.txHash?.toLowerCase() === hash) {
        await prisma.paymentRequest.updateMany({ where: { id: row.id, version: row.version, status: "PROCESSING", txHash: row.txHash }, data: { status: row.expiresAt && row.expiresAt < new Date() ? "EXPIRED" : "PENDING", txHash: null, version: { increment: 1 } } });
      }
      throw new HttpError(proof.reason, 422);
    }
    // Unknown hashes never reserve an invoice or change its displayed state.
    if (proof.verifiedIntent) {
      if (row.txHash && row.txHash.toLowerCase() !== hash) throw new HttpError("A different payment is already being confirmed.", 409);
      await prisma.paymentRequest.updateMany({ where: { id: row.id, version: row.version, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "PROCESSING", txHash: hash, payerAddress: sender.walletAddress.toLowerCase(), version: { increment: 1 } } });
    }
    return { request: (await getByShortId(shortId))!, pending: true };
  }
  if (proof.timestamp < BigInt(Math.floor(row.createdAt.getTime() / 1000))) throw new HttpError("That transfer predates this request.", 422);
  // A real transfer remains Activity even if invoice bookkeeping races or fails.
  await recordDirectPayment(sender, { txHash: hash, recipient: row.recipientAddress, amount: row.amount.toString() });
  const settlementKey = `${row.chainId}:${hash}:${proof.logIndex}`;
  const paidAt = new Date(Number(proof.timestamp) * 1000);
  const late = Boolean((row.expiresAt && paidAt > row.expiresAt) || ["CANCELLED", "DECLINED"].includes(row.status));
  try {
    const result = await prisma.paymentRequest.updateMany({
      where: { id: row.id, version: row.version, status: { notIn: ["PAID", "LATE_PAID"] } },
      data: { status: late ? "LATE_PAID" : "PAID", settlementKey, txHash: hash, payerAddress: proof.from.toLowerCase(), paidAt, version: { increment: 1 } },
    });
    const latest = (await getByShortId(shortId))!;
    if (result.count === 0 && latest.settlementKey !== settlementKey) throw new HttpError("The invoice changed during confirmation. The transfer was sent; refresh or contact the merchant with its hash.", 409);
    return { request: latest, pending: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError("That transfer already settled another request.", 409);
    throw error;
  }
}

export async function closeRequest(shortId: string, wallet: string, action: "cancel" | "decline") {
  const row = await getByShortId(shortId);
  if (!row) throw new HttpError("Request not found.", 404);
  const actor = action === "cancel" ? row.creatorAddress : row.intendedPayerAddress;
  if (actor !== wallet.toLowerCase()) throw new HttpError("You cannot change this request.", 403);
  if (row.status !== "PENDING" || row.txHash) throw new HttpError("Only an unpaid, open request can be changed.", 409);
  const result = await prisma.paymentRequest.updateMany({ where: { id: row.id, status: "PENDING", version: row.version }, data: { status: action === "cancel" ? "CANCELLED" : "DECLINED", version: { increment: 1 } } });
  if (!result.count) throw new HttpError("This request changed. Refresh and try again.", 409);
  return (await getByShortId(shortId))!;
}
