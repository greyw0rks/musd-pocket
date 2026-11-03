import { z } from "zod";
import { isAddress } from "viem";

/** Exact positive token amounts fitting DECIMAL(38,18). */
export const paymentAmountSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/, "Invalid amount")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");

export const directPaymentSchema = z
  .object({
    txHash: z
      .string()
      .trim()
      .regex(/^0x[\da-fA-F]{64}$/)
      .transform((value) => value.toLowerCase()),
    recipient: z
      .string()
      .trim()
      .refine((value) => isAddress(value), "Invalid recipient")
      .transform((value) => value.toLowerCase()),
    amount: paymentAmountSchema,
  })
  .strict();

export type DirectPaymentInput = z.input<typeof directPaymentSchema>;
