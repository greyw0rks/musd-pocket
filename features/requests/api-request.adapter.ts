import type { AuthedFetch } from "@/lib/auth/client";
import { toDisplayUnits, unitsToDecimal } from "@/features/payments/amount";
import { parseMusd } from "@/lib/mezo/musd";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { checkoutPath } from "@/lib/requests/links";
import type { PaymentRequest, RequestService } from "./request.types";

const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

export function requestFromRow(
  row: SerializedRequest,
  wallet: string,
): PaymentRequest {
  const incoming = row.creatorAddress.toLowerCase() !== wallet.toLowerCase();
  const counterparty = incoming ? row.creatorAddress : row.intendedPayerAddress;
  const expiresAt = row.expiresAt
    ? new Date(row.expiresAt)
    : new Date("9999-12-31T00:00:00.000Z");
  const status: PaymentRequest["status"] =
    row.status === "LATE_PAID"
      ? "late_paid"
      : row.status === "PAID"
        ? "paid"
        : row.status === "PROCESSING"
          ? "processing"
          : row.status === "DECLINED"
            ? "declined"
            : row.status === "CANCELLED"
              ? "cancelled"
              : row.status === "EXPIRED" || expiresAt.getTime() < Date.now()
                ? "expired"
                : "open";
  return {
    id: row.shortId,
    direction: incoming ? "incoming" : "outgoing",
    counterpartyId: counterparty ?? "anyone",
    counterpartyName:
      incoming && row.merchantName
        ? row.merchantName
        : counterparty
          ? short(counterparty)
          : "Anyone with the link",
    counterpartyHandle: counterparty
      ? short(counterparty)
      : "Share to receive payment",
    amountUnits: toDisplayUnits(parseMusd(row.amount)),
    amountDisplay: `${row.amount} mUSD`,
    note: row.description ?? undefined,
    status,
    kind: "onchain",
    createdAt: new Date(row.createdAt),
    expiresAt,
    settledAt: row.paidAt ? new Date(row.paidAt) : undefined,
    checkoutPath: row.version === 2 ? checkoutPath(row.shortId) : undefined,
  };
}

/** Requests always pay their creator. The contact is an optional intended payer. */
export function createApiRequestService(deps: {
  fetchAuthed: AuthedFetch;
  getWalletAddress: () => string | null;
}): RequestService {
  const { fetchAuthed, getWalletAddress } = deps;
  return {
    async list() {
      const rows = await fetchAuthed<SerializedRequest[]>("/api/requests");
      return rows.map((row) => requestFromRow(row, getWalletAddress() ?? ""));
    },
    async create(input) {
      if (input.amountUnits <= 0n)
        return { ok: false, error: "Enter an amount greater than zero." };
      if (input.counterparty && !input.counterparty.address)
        return { ok: false, error: "That contact has no wallet address." };
      try {
        const row = await fetchAuthed<SerializedRequest>("/api/requests", {
          method: "POST",
          body: JSON.stringify({
            ...(input.counterparty?.address
              ? { intendedPayerAddress: input.counterparty.address }
              : {}),
            amount: unitsToDecimal(input.amountUnits),
            expiry: "7d",
            ...(input.note ? { description: input.note } : {}),
            ...(input.merchantName ? { merchantName: input.merchantName } : {}),
          }),
        });
        return {
          ok: true,
          request: requestFromRow(row, getWalletAddress() ?? ""),
        };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not create this request.",
        };
      }
    },
    async pay() {
      return {
        ok: false,
        error: "Open the payment link to review and pay this request.",
      };
    },
    async decline() {
      throw new Error("Declining a request is not available yet.");
    },
    async cancel() {
      throw new Error("Cancelling a request is not available yet.");
    },
    capabilities: { decline: false, withdraw: false },
  };
}
