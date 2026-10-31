import { parseUnits, formatUnits } from "viem";

/** The payment UI/history use cents; never round a value the user authorized. */
export function paymentAmount(input: unknown): string {
  if (typeof input !== "string" || !/^\d{1,20}(\.\d{1,2})?$/.test(input) || parseUnits(input, 18) <= 0n) {
    throw new Error("Enter a positive mUSD amount with at most two decimal places.");
  }
  return formatUnits(parseUnits(input, 18), 18);
}
