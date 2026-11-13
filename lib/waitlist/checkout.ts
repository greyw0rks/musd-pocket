import "server-only";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/request";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { toStorageAddress } from "@/lib/utils";
import { WAITLIST_OFFER } from "./offer";

const makeShortId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 24);

/** One invoice per wallet/campaign. Opening or retrying never sends funds. */
export async function getWaitlistCheckout(wallet: string) {
  if (CHAIN_ID !== WAITLIST_OFFER.chainId)
    throw new HttpError("The waitlist payment pilot is available on Mezo testnet.", 409);
  const payer = toStorageAddress(wallet);
  const offer = WAITLIST_OFFER;
  if (payer === offer.merchantWallet)
    throw new HttpError("The Pocket merchant wallet cannot pay its own waitlist checkout.", 409);
  const merchant = await prisma.user.findUnique({
    where: { username: offer.merchantUsername },
    select: { walletAddress: true, role: true, businessName: true },
  });
  if (
    merchant?.walletAddress !== offer.merchantWallet ||
    merchant.role !== "MERCHANT" ||
    merchant.businessName !== offer.merchantName
  )
    throw new HttpError("Waitlist checkout is temporarily unavailable. Try again later.", 503);

  // Retain the completed first pilot payment instead of charging that wallet again.
  const paid = await prisma.paymentRequest.findFirst({
    where: {
      creatorAddress: offer.merchantWallet,
      recipientAddress: offer.merchantWallet,
      description: offer.description,
      amount: offer.amount,
      chainId: CHAIN_ID,
      token: MUSD_ADDRESS.toLowerCase(),
      version: 2,
      payerAddress: payer,
      status: { in: ["PAID", "LATE_PAID"] },
    },
  });
  if (paid) return paid;

  // The primary key is stable across tabs/devices; the public link stays random.
  // An empty update preserves paid/processing states and any saved proof.
  const id = `${offer.campaign}:${payer}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.paymentRequest.upsert({
        where: { id },
        update: {},
        create: {
          id,
          shortId: makeShortId(),
          creatorAddress: offer.merchantWallet,
          recipientAddress: offer.merchantWallet,
          intendedPayerAddress: payer,
          merchantName: offer.merchantName,
          description: offer.description,
          amount: offer.amount,
          token: MUSD_ADDRESS.toLowerCase(),
          chainId: CHAIN_ID,
          version: 2,
        },
      });
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002")
        throw error;
      // Also handles Prisma's read/insert upsert path when another tab wins.
      const existing = await prisma.paymentRequest.findUnique({ where: { id } });
      if (existing) return existing;
      // A public shortId collision can safely retry with a different random ID.
    }
  }
  throw new HttpError("Could not prepare checkout. Please try again.", 503);
}
