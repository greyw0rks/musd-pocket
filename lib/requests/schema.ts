import { z } from "zod";
import { isAddress } from "viem";
import { paymentAmount } from "@/lib/payments/amount";

const addressSchema = z
  .string()
  .refine((v) => isAddress(v), { message: "Invalid EVM address" });

const amountSchema = z.string().refine((value) => {
  try { paymentAmount(value); return true; } catch { return false; }
}, { message: "Enter a positive mUSD amount with at most two decimal places" });

/**
 * Request creation, minus the creator.
 *
 * The creator is the authenticated caller — `POST /api/requests` reads it from
 * the verified token, never from the body. An earlier revision took
 * `creatorAddress` as a field, which let anyone create a request *as* somebody
 * else; the field is gone on purpose, not overlooked.
 */
export const createRequestSchema = z.object({
  recipientAddress: addressSchema,
  amount: amountSchema,
  description: z.string().trim().max(120).optional().nullable(),
  expiry: z.enum(["never", "24h", "7d"]).default("never"),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const createInvoiceSchema = z.object({
  amount: amountSchema,
  description: z.string().trim().max(120).optional().nullable(),
  expiry: z.enum(["24h", "7d"]).default("24h"),
}).strict();
export const merchantProfileSchema = z.object({ businessName: z.string().trim().min(2).max(80) }).strict();

export function expiryToHours(expiry: "never" | "24h" | "7d"): number | null {
  if (expiry === "24h") return 24;
  if (expiry === "7d") return 24 * 7;
  return null;
}

export const payRequestSchema = z.object({
  txHash: z
    .string()
    .refine((v) => /^0x[0-9a-fA-F]{64}$/.test(v), {
      message: "Invalid transaction hash",
    }),
});

/**
 * Contact creation, minus the owner.
 *
 * As with requests, the owner is the authenticated caller. The absence of
 * `ownerAddress` here is the fix for a real hole: the old shape let a caller
 * name any address as the owner and write contacts into someone else's list.
 */
export const createContactSchema = z.object({
  contactAddress: addressSchema,
  label: z.string().trim().min(1).max(40),
});

export const updateContactSchema = z.object({
  label: z.string().trim().min(1).max(40),
});
