import { createPublicClient, http, getAddress, formatUnits, parseUnits } from "viem";
import type { Address } from "viem";
import { activeChain, RPC_URL, MUSD_DECIMALS } from "./config";

/** Minimal ERC-20 surface Pocket needs: read balance/metadata + Transfer event. */
export const MUSD_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

/** Server-side read client (no wallet). Used by the payment verifier. */
export function getPublicClient() {
  return createPublicClient({
    chain: activeChain,
    transport: http(RPC_URL),
  });
}

/** UI helpers — display checksummed, store lowercase (see lib/utils). */
export function formatMusd(value: bigint): string {
  return formatUnits(value, MUSD_DECIMALS);
}

export function parseMusd(value: string): bigint {
  return parseUnits(value, MUSD_DECIMALS);
}

export function normalizeAddress(address: string): Address {
  // checksummed form; throws on invalid input
  return getAddress(address);
}
