import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TransactionDetailScreen } from "@/components/pocket/ledger/TransactionDetailScreen";
import type { Transaction } from "./payment.types";

const recipient = {
  id: "customer",
  name: "Customer",
  handle: "@customer",
  verified: true,
};
const transaction: Transaction = {
  id: "payment",
  recipientId: recipient.id,
  recipientName: recipient.name,
  recipientHandle: recipient.handle,
  asset: "MUSD",
  amountUnits: 225n,
  amountDisplay: "2.25 MUSD",
  direction: "sent",
  status: "pending",
  kind: "onchain",
  createdAt: new Date(0),
  txHash: `0x${"a".repeat(64)}`,
  chainId: 31611,
};
it("offers confirmation recovery instead of another send for a pending payment", () => {
  const html = renderToStaticMarkup(
    createElement(TransactionDetailScreen, {
      transaction,
      recipient,
      onBack() {},
      onSendAgain() {},
      onRefresh: async () => {},
    }),
  );
  expect(html).toContain("Check confirmation");
  expect(html).toContain("Mezo testnet");
  expect(html).toContain("View on explorer");
  expect(html).not.toContain("Send again");
  expect(html).not.toContain("Nothing here has reached a blockchain");
});
