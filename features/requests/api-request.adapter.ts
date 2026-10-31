import { type AuthedFetch } from "@/lib/auth/client";
import { parseDecimalToUnits, unitsToDecimal } from "@/features/payments/amount";
import type { PaymentService } from "@/features/payments/payment.types";
import type { SerializedRequest } from "@/lib/requests/serialize";
import type { PaymentRequest, RequestService, RequestStatus } from "./request.types";

const NEVER_EXPIRES = new Date("9999-12-31T00:00:00.000Z");
const STATUSES: Record<SerializedRequest["status"], RequestStatus> = {
  PENDING: "open", PROCESSING: "processing", PAID: "paid", LATE_PAID: "late-paid",
  EXPIRED: "expired", CANCELLED: "cancelled", DECLINED: "declined",
};

export function toPaymentRequest(row: SerializedRequest, wallet: string | null): PaymentRequest {
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : NEVER_EXPIRES;
  const incoming = row.creatorAddress.toLowerCase() !== wallet?.toLowerCase();
  const counterparty = incoming ? row.creatorAddress : row.intendedPayerAddress;
  const name = incoming && row.merchantName ? row.merchantName : counterparty ? `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}` : "Anyone with the link";
  return {
    id: row.shortId, direction: incoming ? "incoming" : "outgoing",
    counterpartyId: counterparty ?? "", counterpartyName: name, counterpartyHandle: name,
    amountUnits: parseDecimalToUnits(row.amount) ?? 0n,
    ...(row.description ? { note: row.description } : {}),
    status: row.status === "PENDING" && expiresAt.getTime() < Date.now() ? "expired" : STATUSES[row.status],
    kind: "onchain", createdAt: new Date(row.createdAt), expiresAt,
    ...(row.paidAt ? { settledAt: new Date(row.paidAt) } : {}),
    checkoutUrl: `/pay/${row.shortId}`,
    ...(row.txHash ? { txHash: row.txHash } : {}),
  };
}

export function createApiRequestService(deps: {
  fetchAuthed: AuthedFetch; payments: PaymentService; getWalletAddress: () => string | null;
}): RequestService {
  const { fetchAuthed, getWalletAddress } = deps;
  const map = (row: SerializedRequest) => toPaymentRequest(row, getWalletAddress());
  async function close(id: string, action: "cancel" | "decline") {
    return map(await fetchAuthed<SerializedRequest>(`/api/requests/${id}/close`, { method: "POST", body: JSON.stringify({ action }) }));
  }
  return {
    async list() { return (await fetchAuthed<SerializedRequest[]>("/api/requests")).map(map); },
    async create(input) {
      if (input.amountUnits <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
      if (!input.counterparty.address) return { ok: false, error: "That contact has no wallet address yet." };
      try {
        const row = await fetchAuthed<SerializedRequest>("/api/requests", { method: "POST", body: JSON.stringify({
          recipientAddress: input.counterparty.address, amount: unitsToDecimal(input.amountUnits),
          ...(input.note ? { description: input.note } : {}),
        }) });
        return { ok: true, request: map(row) };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not create that request." }; }
    },
    // Checkout owns the review, signature, persistent hash and receipt recovery.
    async pay() { return { ok: false, error: "Open this request's checkout to review and pay it." }; },
    decline: id => close(id, "decline"), cancel: id => close(id, "cancel"),
    capabilities: { decline: true, withdraw: true },
  };
}
