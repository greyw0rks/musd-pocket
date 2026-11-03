import { parseUnits } from "viem";

export function exactAmount(text: string, decimals: number): bigint {
  const value = text.trim();
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 36 ||
    !/^(?:\d+)(?:\.\d+)?$/.test(value) ||
    (value.split(".")[1]?.length ?? 0) > decimals
  )
    throw new Error(
      `Enter a positive amount with up to ${decimals} decimal places.`,
    );
  const amount = parseUnits(value, decimals);
  if (amount <= 0n || amount >= 2n ** 256n)
    throw new Error("Enter an amount greater than zero.");
  return amount;
}

export function minimumAmount(amount: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 100)
    throw new Error("Choose slippage from 0.1% to 1%.");
  const minimum = (amount * BigInt(10000 - slippageBps)) / 10000n;
  if (minimum <= 0n)
    throw new Error("This amount is too small for a protected quote.");
  return minimum;
}

export const WEEK = 604800n;
export function roundedLockEnd(
  timestamp: bigint,
  weeks: number,
  maxTime: bigint,
) {
  if (!Number.isInteger(weeks) || weeks < 1 || BigInt(weeks) * WEEK > maxTime)
    throw new Error("Choose a supported lock duration.");
  const duration = BigInt(weeks) * WEEK;
  const end = ((timestamp + duration) / WEEK) * WEEK;
  if (end <= timestamp) throw new Error("Choose a later unlock date.");
  return { duration, end };
}
