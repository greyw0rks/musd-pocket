import type { PaymentRequest } from "@prisma/client";

export type SerializedRequest = {
  shortId: string;
  displayId: string;
  creatorAddress: string;
  recipientAddress: string;
  amount: string;
  token: string;
  chainId: number;
  description: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "EXPIRED";
  txHash: string | null;
  payerAddress: string | null;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
};

export function serializeRequest(r: PaymentRequest): SerializedRequest {
  return {
    shortId: r.shortId,
    displayId: `POCKET-${r.shortId}`,
    creatorAddress: r.creatorAddress,
    recipientAddress: r.recipientAddress,
    amount: r.amount.toString(),
    token: r.token,
    chainId: r.chainId,
    description: r.description,
    status: r.status,
    txHash: r.txHash,
    payerAddress: r.payerAddress,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
  };
}
