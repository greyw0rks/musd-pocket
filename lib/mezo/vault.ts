import { getAddress } from "viem";
import type { Address } from "viem";
import { getPublicClient } from "./musd";

/**
 * PocketVault — the on-chain liquidity leg (Mezo testnet). ABI mirrors
 * `contracts/src/PocketVault.sol` exactly; keep the two in sync. This module is
 * client+server safe (no private key, no `server-only`): the UI uses the ABI +
 * public address to show the deposit target, the backend uses the read helpers
 * to index and reconcile. The ENGINE signer that *moves* funds lives in
 * `lib/settlement/engine.ts` (server-only).
 */
export const POCKET_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "paymentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "processed",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "paymentId", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "Payout",
    inputs: [
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "paymentId", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "paymentId", type: "bytes32" },
    ],
  },
] as const;

/**
 * The deployed PocketVault address. Public (the deposit screen shows it), so it
 * rides on a NEXT_PUBLIC_ var like MUSD_ADDRESS. Empty until Phase B deploy —
 * callers guard with hasVault().
 */
const RAW_VAULT = process.env.NEXT_PUBLIC_POCKET_VAULT_ADDRESS;

export function hasVault(): boolean {
  return Boolean(RAW_VAULT);
}

export function getVaultAddress(): Address {
  if (!RAW_VAULT) throw new Error("NEXT_PUBLIC_POCKET_VAULT_ADDRESS is not set");
  return getAddress(RAW_VAULT);
}

/** Current MUSD liquidity held by the vault (base units). */
export async function readVaultLiquidity(): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: getVaultAddress(),
    abi: POCKET_VAULT_ABI,
    functionName: "liquidity",
  });
}

/** Whether a paymentId has already released funds (idempotency check). */
export async function isPaymentProcessed(paymentId: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: getVaultAddress(),
    abi: POCKET_VAULT_ABI,
    functionName: "processed",
    args: [paymentId],
  });
}
