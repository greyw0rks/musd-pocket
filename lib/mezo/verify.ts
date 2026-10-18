import { parseEventLogs } from "viem";
import type { Address, Hash } from "viem";
import { getPublicClient, MUSD_ABI, parseMusd } from "./musd";
import { parseBtc } from "./borrow-format";
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

/**
 * Independently verify a claimed **native BTC** transfer against the chain.
 *
 * The sibling of `verifyMusdPayment`, and the difference is the whole reason
 * this exists separately: an ERC-20 transfer leaves a log to be found, and a
 * native transfer leaves none. There is no event to parse — the chain's own
 * transaction *is* the record, so the check is of the transaction's fields
 * rather than of a log inside its receipt.
 *
 * Checks, in order:
 *   1. receipt exists (else still pending / dropped)
 *   2. tx succeeded
 *   3. the input is empty — a plain value transfer, not a call to a contract
 *      that happens to be paid. The app only ever produces the former, so a
 *      transaction with calldata is not the transaction being claimed.
 *   4. to == the requested recipient
 *   5. value == the exact requested amount
 *
 * Returns the sender so the caller can check it against the identity that made
 * the request — that check belongs to the route, which is the only layer that
 * knows who is asking. The chain is pinned by the RPC (active env), so chainId
 * cannot be spoofed here.
 *
 * `amount` is human BTC (`"0.005"`), matching what the route stores and what
 * `parseBtc` round-trips.
 */
export async function verifyBtcTransfer(params: {
  txHash: Hash;
  recipient: string; // lowercase or checksummed
  amount: string; // human BTC, e.g. "0.005"
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

  /*
    The transaction, not just its receipt. A native transfer's amount and
    destination are not derivable from a receipt — a receipt says what the
    transaction cost and what it emitted, and this one emitted nothing.
  */
  let tx;
  try {
    tx = await client.getTransaction({ hash: params.txHash });
  } catch {
    return { valid: false, reason: "Transaction not found yet", pending: true };
  }

  if (tx.to === null) {
    // Contract creation. It cannot be a transfer to a recipient, whatever the
    // claim says.
    return { valid: false, reason: "That transaction is not a transfer" };
  }

  if (tx.input !== "0x") {
    return {
      valid: false,
      reason: "That transaction called a contract rather than transferring Bitcoin",
    };
  }

  if (tx.to.toLowerCase() !== params.recipient.toLowerCase()) {
    return {
      valid: false,
      reason: "That transfer did not go to the requested recipient",
    };
  }

  const expected = parseBtc(params.amount);
  if (expected === null || tx.value !== expected) {
    return {
      valid: false,
      reason: "The amount transferred does not match the amount claimed",
    };
  }

  return { valid: true, from: tx.from, to: tx.to, value: tx.value };
}
