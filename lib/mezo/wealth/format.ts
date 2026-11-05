import { formatUnits } from "viem";

/** Display balances with at most six decimals, retaining exact values for actions. */
export function formatTokenBalance(amount: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(amount, decimals).split(".");
  const visible = fraction.slice(0, 6).replace(/0+$/, "");
  if (amount > 0n && whole === "0" && !visible) return "<0.000001";
  return visible ? `${whole}.${visible}` : whole;
}
