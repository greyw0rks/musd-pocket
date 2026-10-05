import { parseEventLogs } from "viem";
import type { Address, Hash } from "viem";
import { getPublicClient, MUSD_ABI, parseMusd } from "./musd";
import { MUSD_ADDRESS, CHAIN_ID } from "./config";

export type VerifyResult =
  | { valid: true; from: Address; to: Address; value: bigint }
  | { valid: false; reason: string; pending?: boolean };

/**
 * Independently verify a claimed mUSD payment against the chain — never trust
 * the frontend's word that a request was paid. (Build order milestone #4.)
 *
 * Checks, in order:
 *   1. receipt exists (else still pending / dropped)
 *   2. tx succeeded
 *   3. a Transfer log emitted BY the mUSD token contract
 *   4. to == the request's recipient
 *   5. value == the exact requested amount (base units)
 * The chain is pinned by the RPC (active env), so chainId can't be spoofed here.
 */
export async function verifyMusdPayment(params: {
  txHash: Hash;
  recipient: string; // lowercase or checksummed
  amount: string; // human mUSD units, e.g. "25" or "25.00"
}): Promise<VerifyResult> {
  const client = getPublicClient();

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash });
  } catch {
    return { valid: false, reason: "Transaction not found yet", pending: true };
  }

  if (receipt.status !== "success") {
    return { valid: false, reason: "Transaction reverted" };
  }

  const expected = parseMusd(params.amount);
  const recipient = params.recipient.toLowerCase();

  // Only Transfer events emitted by the mUSD contract itself count.
  const transfers = parseEventLogs({
    abi: MUSD_ABI,
    eventName: "Transfer",
    logs: receipt.logs.filter(
      (l) => l.address.toLowerCase() === MUSD_ADDRESS.toLowerCase(),
    ),
  });

  const match = transfers.find(
    (t) =>
      t.args.to?.toLowerCase() === recipient && t.args.value === expected,
  );

  if (!match) {
    return {
      valid: false,
      reason:
        "No mUSD Transfer to the requested recipient for the exact amount",
    };
  }

  return {
    valid: true,
    from: match.args.from as Address,
    to: match.args.to as Address,
    value: match.args.value as bigint,
  };
}

export const VERIFY_CHAIN_ID = CHAIN_ID;
