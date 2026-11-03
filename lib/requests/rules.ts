import type { SerializedRequest } from "./serialize";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";

export function checkoutBlockReason(
  request: SerializedRequest,
  payer: string,
  now = Date.now(),
): string | null {
  if (
    request.version !== 2 ||
    request.recipientAddress !== request.creatorAddress
  )
    return "Ask the requester for a new payment link. This older link cannot be paid.";
  if (
    request.chainId !== CHAIN_ID ||
    request.token.toLowerCase() !== MUSD_ADDRESS.toLowerCase()
  )
    return "This request uses a different network or token.";
  if (request.status === "PAID" || request.status === "LATE_PAID")
    return "This request has already been paid.";
  if (request.status === "CANCELLED" || request.status === "DECLINED")
    return "This request is closed.";
  if (request.txHash || request.status === "PROCESSING")
    return "A payment is already being checked. Do not send again.";
  if (
    request.status === "EXPIRED" ||
    (request.expiresAt && new Date(request.expiresAt).getTime() <= now)
  )
    return "This request has expired. Ask for a new link.";
  if (request.recipientAddress === payer.toLowerCase())
    return "This is your payment link. Share it to receive payment.";
  if (
    request.intendedPayerAddress &&
    request.intendedPayerAddress !== payer.toLowerCase()
  )
    return "This request is addressed to a different wallet.";
  return null;
}
