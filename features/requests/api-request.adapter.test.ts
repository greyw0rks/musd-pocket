import { describe, expect, it, vi } from "vitest";
import { createApiRequestService, requestFromRow } from "./api-request.adapter";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";

const owner = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const row: SerializedRequest = {
  shortId: "A".repeat(24),
  displayId: "POCKET-" + "A".repeat(24),
  creatorAddress: owner,
  recipientAddress: owner,
  intendedPayerAddress: payer,
  merchantName: "Store",
  amount: "2.25",
  version: 2,
  chainId: CHAIN_ID,
  token: MUSD_ADDRESS,
  status: "PENDING",
  description: null,
  txHash: null,
  payerAddress: null,
  expiresAt: "2030-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  paidAt: null,
};

describe("request adapter", () => {
  it("shows a request as outgoing for its owner and incoming for its payer", () => {
    expect(requestFromRow(row, owner)).toMatchObject({
      direction: "outgoing",
      counterpartyId: payer,
    });
    expect(requestFromRow(row, payer)).toMatchObject({
      direction: "incoming",
      counterpartyId: owner,
      counterpartyName: "Store",
    });
    expect(
      requestFromRow({ ...row, intendedPayerAddress: null }, owner)
        .counterpartyName,
    ).toBe("Anyone with the link");
  });
  it("keeps pending and late payments distinct from open requests", () => {
    expect(requestFromRow({ ...row, status: "PROCESSING" }, payer).status).toBe(
      "processing",
    );
    expect(requestFromRow({ ...row, status: "LATE_PAID" }, payer).status).toBe(
      "late_paid",
    );
  });
  it("preserves the exact amount while converting chart totals to display units", () => {
    expect(
      requestFromRow({ ...row, amount: "2.000000000000000001" }, payer),
    ).toMatchObject({
      amountUnits: 200n,
      amountDisplay: "2.000000000000000001 mUSD",
    });
  });
  it("creates an anyone link without client-selected ownership fields", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValue({ ...row, intendedPayerAddress: null });
    const service = createApiRequestService({
      fetchAuthed,
      getWalletAddress: () => owner,
    });
    expect(
      (await service.create({ amountUnits: 225n, merchantName: "Store" })).ok,
    ).toBe(true);
    expect(JSON.parse(fetchAuthed.mock.calls[0][1].body)).toEqual({
      amount: "2.25",
      merchantName: "Store",
      expiry: "7d",
    });
  });
  it("sends selected contacts as intended payers, never as recipients", async () => {
    const fetchAuthed = vi.fn().mockResolvedValue(row);
    const service = createApiRequestService({
      fetchAuthed,
      getWalletAddress: () => owner,
    });
    await service.create({
      amountUnits: 225n,
      counterparty: {
        id: "contact",
        name: "Customer",
        handle: "@customer",
        address: payer,
        verified: false,
      },
    });
    expect(JSON.parse(fetchAuthed.mock.calls[0][1].body)).toEqual({
      amount: "2.25",
      intendedPayerAddress: payer,
      expiry: "7d",
    });
    expect((await service.pay(row.shortId)).ok).toBe(false);
    expect(fetchAuthed).toHaveBeenCalledTimes(1);
  });
});
