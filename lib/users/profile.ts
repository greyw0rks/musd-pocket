import { z } from "zod";
import {
  normaliseHandle,
  validateHandleFormat,
} from "@/features/session/handle";

export const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .transform(normaliseHandle)
      .refine(
        (value) => !validateHandleFormat(value),
        "Use 3–20 letters, numbers or underscores for your username.",
      )
      .optional(),
    accountType: z.enum(["personal", "merchant"]).optional(),
    businessName: z
      .string()
      .trim()
      .max(80, "Business names must be 80 characters or fewer.")
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Choose a profile setting to update.",
  );

export function profileData(
  input: z.infer<typeof profileUpdateSchema>,
  current: { role: "PERSONAL" | "MERCHANT"; businessName: string | null },
) {
  const role = input.accountType
    ? input.accountType === "merchant"
      ? "MERCHANT"
      : "PERSONAL"
    : current.role;
  const businessName =
    input.businessName === undefined
      ? current.businessName
      : input.businessName || null;
  return {
    ...(input.username !== undefined ? { username: input.username } : {}),
    role,
    businessName,
  };
}
