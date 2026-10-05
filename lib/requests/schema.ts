import { z } from "zod";
import { isAddress } from "viem";
import { MUSD_DECIMALS } from "@/lib/mezo/config";

const addressSchema = z
  .string()
  .refine((v) => isAddress(v), { message: "Invalid EVM address" });

const amountSchema = z
  .string()
  .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: "Invalid amount" })
  .refine((v) => Number(v) > 0, { message: "Amount must be greater than 0" })
  .refine((v) => (v.split(".")[1]?.length ?? 0) <= MUSD_DECIMALS, {
    message: `Max ${MUSD_DECIMALS} decimals`,
  });

export const createRequestSchema = z.object({
  creatorAddress: addressSchema,
  recipientAddress: addressSchema,
  amount: amountSchema,
  description: z.string().trim().max(120).optional().nullable(),
  expiry: z.enum(["never", "24h", "7d"]).default("never"),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

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

export const createContactSchema = z.object({
  ownerAddress: addressSchema,
  contactAddress: addressSchema,
  label: z.string().trim().min(1).max(40),
});

export const updateContactSchema = z.object({
  label: z.string().trim().min(1).max(40),
});
