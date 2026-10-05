import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";
import { toStorageAddress } from "@/lib/utils";

// Unambiguous uppercase alphabet (no O/0, I/1 confusion) for shareable IDs.
const makeShortId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export function displayId(shortId: string) {
  return `POCKET-${shortId}`;
}

export async function createPaymentRequest(input: {
  creatorAddress: string;
  recipientAddress: string;
  amount: string;
  description?: string | null;
  expiresInHours?: number | null; // null/undefined = never
}) {
  // Retry on the rare shortId collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = makeShortId();
    try {
      return await prisma.paymentRequest.create({
        data: {
          shortId,
          creatorAddress: toStorageAddress(input.creatorAddress),
          recipientAddress: toStorageAddress(input.recipientAddress),
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
  const req = await prisma.paymentRequest.findUnique({
    where: { shortId: shortId.toUpperCase() },
  });
  if (!req) return null;

  if (
    req.status === "PENDING" &&
    req.expiresAt &&
    req.expiresAt.getTime() < Date.now()
  ) {
    return prisma.paymentRequest.update({
      where: { id: req.id },
      data: { status: "EXPIRED" },
    });
  }
  return req;
}

export async function listByCreator(
  creatorAddress: string,
  status?: "PENDING" | "PROCESSING" | "PAID" | "EXPIRED",
) {
  return prisma.paymentRequest.findMany({
    where: {
      creatorAddress: toStorageAddress(creatorAddress),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markProcessing(shortId: string, txHash: string) {
  return prisma.paymentRequest.update({
    where: { shortId: shortId.toUpperCase() },
    data: { status: "PROCESSING", txHash },
  });
}

export async function confirmPaid(
  shortId: string,
  data: { txHash: string; payerAddress: string },
) {
  return prisma.paymentRequest.update({
    where: { shortId: shortId.toUpperCase() },
    data: {
      status: "PAID",
      txHash: data.txHash,
      payerAddress: toStorageAddress(data.payerAddress),
      paidAt: new Date(),
    },
  });
}
