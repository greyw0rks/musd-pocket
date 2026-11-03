import { decodeFunctionData, parseEventLogs, type Hash } from "viem";
import { getPublicClient, MUSD_ABI, parseMusd } from "@/lib/mezo/musd";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";

export type DirectTransferProof =
  | { valid: true; from: string; timestamp: bigint; blockNumber: bigint }
  | {
      valid: false;
      reason: string;
      pending?: boolean;
      verifiedIntent?: boolean;
      reverted?: boolean;
    };

/** Verify the signer and calldata even when a receipt is temporarily unavailable. */
export async function verifyDirectTransfer(input: {
  txHash: Hash;
  sender: string;
  recipient: string;
  amount: string;
}): Promise<DirectTransferProof> {
  const rpc = getPublicClient();
  if ((await rpc.getChainId()) !== CHAIN_ID)
    return { valid: false, reason: "RPC is on the wrong network" };
  let tx;
  try {
    tx = await rpc.getTransaction({ hash: input.txHash });
  } catch {
    return {
      valid: false,
      pending: true,
      verifiedIntent: false,
      reason: "Transaction is not readable yet",
    };
  }
  if (
    tx.from.toLowerCase() !== input.sender.toLowerCase() ||
    tx.to?.toLowerCase() !== MUSD_ADDRESS.toLowerCase() ||
    tx.value !== 0n
  ) {
    return {
      valid: false,
      reason: "That is not an mUSD transfer from your wallet",
    };
  }
  const amount = parseMusd(input.amount);
  try {
    const call = decodeFunctionData({ abi: MUSD_ABI, data: tx.input });
    if (
      call.functionName !== "transfer" ||
      call.args[0].toLowerCase() !== input.recipient.toLowerCase() ||
      call.args[1] !== amount
    ) {
      return {
        valid: false,
        reason: "The recipient or amount does not match this payment",
      };
    }
  } catch {
    return { valid: false, reason: "That is not a direct mUSD transfer" };
  }
  let receipt;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: input.txHash });
  } catch {
    return {
      valid: false,
      pending: true,
      verifiedIntent: true,
      reason: "Waiting for the receipt",
    };
  }
  if (receipt.status !== "success")
    return { valid: false, reverted: true, reason: "Transaction reverted" };
  const logs = parseEventLogs({
    abi: MUSD_ABI,
    eventName: "Transfer",
    logs: receipt.logs.filter(
      (log) => log.address.toLowerCase() === MUSD_ADDRESS.toLowerCase(),
    ),
  });
  if (
    !logs.some(
      (log) =>
        log.args.from.toLowerCase() === input.sender.toLowerCase() &&
        log.args.to.toLowerCase() === input.recipient.toLowerCase() &&
        log.args.value === amount,
    )
  ) {
    return {
      valid: false,
      reason: "No matching mUSD transfer was found in the receipt",
    };
  }
  return {
    valid: true,
    from: tx.from.toLowerCase(),
    timestamp: (await rpc.getBlock({ blockNumber: receipt.blockNumber }))
      .timestamp,
    blockNumber: receipt.blockNumber,
  };
}
