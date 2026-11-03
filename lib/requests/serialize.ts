import type { PaymentRequest, RequestStatus } from "@prisma/client";

export type SerializedRequest = {
  shortId: string;
  displayId: string;
  creatorAddress: string;
  recipientAddress: string;
  intendedPayerAddress: string | null;
  merchantName: string | null;
  version: number;
  amount: string;
  token: string;
  chainId: number;
  description: string | null;
  status: RequestStatus;
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
    intendedPayerAddress: r.intendedPayerAddress,
    merchantName: r.merchantName,
    version: r.version,
    amount: r.amount.toFixed(),
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
