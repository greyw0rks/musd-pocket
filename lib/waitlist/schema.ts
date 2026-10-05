import { z } from "zod";

/**
 * Waitlist signup. Email is normalised to lowercase here so the `@unique`
 * constraint keeps duplicate signups genuinely idempotent.
 */
export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Enter a valid email address")
    .max(254, "Enter a valid email address")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid email address",
    })
    .transform((v) => v.toLowerCase()),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
