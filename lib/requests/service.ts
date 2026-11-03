import { customAlphabet } from "nanoid";
import type { RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";
import { toStorageAddress } from "@/lib/utils";
import { HttpError } from "@/lib/auth/request";
import { normalizeRequestId } from "./links";

// Unambiguous uppercase alphabet (no O/0, I/1 confusion) for shareable IDs.
const makeShortId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 24);

export function displayId(shortId: string) {
  return `POCKET-${shortId}`;
}

export async function createPaymentRequest(input: {
  creatorAddress: string;
  intendedPayerAddress?: string;
  merchantName?: string;
  amount: string;
  description?: string | null;
  expiresInHours?: number | null; // null/undefined = never
}) {
  if (
    input.intendedPayerAddress?.toLowerCase() ===
    input.creatorAddress.toLowerCase()
  ) {
    throw new HttpError("Choose somebody else to pay this request.");
  }
  // Retry on the rare shortId collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = makeShortId();
    try {
      return await prisma.paymentRequest.create({
        data: {
          shortId,
          creatorAddress: toStorageAddress(input.creatorAddress),
          recipientAddress: toStorageAddress(input.creatorAddress),
          intendedPayerAddress: input.intendedPayerAddress
            ? toStorageAddress(input.intendedPayerAddress)
            : null,
          merchantName: input.merchantName ?? null,
          version: 2,
          amount: input.amount,
          token: toStorageAddress(MUSD_ADDRESS),
          chainId: CHAIN_ID,
          description: input.description?.trim() || null,
          expiresAt: input.expiresInHours
            ? new Date(Date.now() + input.expiresInHours * 3600_000)
            : null,
        },
      });
    } catch (e: unknown) {
      // Unique constraint on shortId -> try again with a new id.
      if (
        typeof e === "object" &&
        e &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique request id");
}

/** Fetch by shareable id; lazily flips PENDING -> EXPIRED when past expiry. */
export async function getByShortId(shortId: string) {
  const normalized = normalizeRequestId(shortId);
  if (!normalized) return null;
  const req = await prisma.paymentRequest.findUnique({
    where: { shortId: normalized },
  });
  if (!req) return null;

  if (
    req.status === "PENDING" &&
    req.expiresAt &&
    req.expiresAt.getTime() < Date.now()
  ) {
    await prisma.paymentRequest.updateMany({
      where: { id: req.id, status: "PENDING", txHash: null },
      data: { status: "EXPIRED" },
    });
    return prisma.paymentRequest.findUnique({ where: { id: req.id } });
  }
  return req;
}

export async function listForWallet(wallet: string, status?: RequestStatus) {
  const address = toStorageAddress(wallet);
  return prisma.paymentRequest.findMany({
    where: {
      OR: [{ creatorAddress: address }, { intendedPayerAddress: address }],
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
