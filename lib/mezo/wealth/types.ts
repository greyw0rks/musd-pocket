import type { Address, Hex } from "viem";

export type Asset = { address: Address; symbol: string; decimals: number };
export type Spend = { asset: Asset; amount: bigint; spender: Address };
export type WealthCall = { to: Address; data: Hex; value: bigint };
export type WealthPlan = {
  owner: Address;
  chainId: number;
  title: string;
  expiresAt: number;
  details: { label: string; value: string }[];
  spends: Spend[];
  call: WealthCall;
  /** Recheck position/contract configuration before every signature. */
  validate: () => Promise<void>;
};
export type WealthStep = {
  plan: WealthPlan;
  kind: "approval" | "action";
  label: string;
  call: WealthCall;
  estimatedGas: bigint;
  estimatedFee: bigint;
};
export type WealthReceipt = {
  requestId: string;
  hash: Hex | null;
  kind: "approval" | "action";
  status: "pending" | "confirmed" | "reverted";
  title: string;
};
