/**
 * Demo seed data.
 *
 * Everything here is fictional. It exists so the interface can be exercised
 * end to end without a wallet, a chain, or a database — and so that the one
 * question the demo has to answer ("how easily can someone send MUSD to
 * another person?") can be answered in isolation.
 *
 * None of this is real money, and nothing here can move real money.
 */

import type { Recipient, Transaction } from "@/features/payments/payment.types";
import type { PaymentRequest } from "@/features/requests/request.types";

/** Opening balance, in minor units: $7,854.43. */
export const DEMO_BALANCE_UNITS = 785_443n;

/**
 * How long an unanswered request stays open.
 *
 * A week, because a request with no expiry is a request nobody has to answer.
 * The demo resolves expiry by comparing the clock to `expiresAt` at read time
 * rather than by writing a status, so a seeded request can age into `expired`
 * without anything having to run.
 */
export const REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whose phone this is.
 *
 * The demo has no session, no wallet and no sign-in, so the signed-in user is
 * part of the fixture rather than something discovered at runtime.
 */
export const DEMO_USER = {
  name: "Alex Morgan",
  handle: "@alex",
  avatarUrl:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
} as const;

/**
 * Portraits are hot-linked for the demo. Every URL was checked to return 200,
 * and no layout depends on one arriving — each avatar sits on a coloured disc,
 * so a blocked image degrades to a coloured circle rather than a broken box.
 */
export const DEMO_RECIPIENTS: Recipient[] = [
  {
    id: "rcp_sarah",
    name: "Sarah",
    handle: "@sarah",
    address: "0x7a3f4c2b8d1e5a9f0c3b6d2e4a7f1c8b5d9e0a3f",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_pavlo",
    name: "Pavlo",
    handle: "@designwithpavlo",
    address: "0x2c8e1d5a9b4f7c0e3a6d9b2f5c8e1a4d7b0f3c6e",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_jordan",
    name: "Jordan",
    handle: "@jordan",
    address: "0x9f1b4e7a2c5d8f0b3e6a9c2f5d8b1e4a7c0f3d6b",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_chris",
    name: "Chris",
    handle: "@chrisg",
    address: "0x4d7a0c3f6b9e2a5d8c1f4b7e0a3d6c9f2b5e8a1d",
    avatarUrl:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_emily",
    name: "Emily",
    handle: "@emily",
    address: "0x1a4d7b0e3c6f9a2d5b8e1c4f7a0d3b6e9c2f5a8d",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_taylor",
    name: "Taylor",
    handle: "@taylor",
    address: "0x6e9c2f5a8d1b4e7c0a3f6d9b2e5a8c1f4d7b0e3a",
    avatarUrl:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_mia",
    name: "Mia",
    handle: "@miamakes",
    address: "0x3b6e9c2f5a8d1b4e7c0a3f6d9b2e5a8c1f4d7b0e",
    avatarUrl:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_ravi",
    name: "Ravi",
    handle: "@ravi",
    address: "0x8c1f4d7b0e3a6c9f2b5e8a1d4c7f0b3e6a9d2c5f",
    avatarUrl:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
  {
    id: "rcp_nadia",
    name: "Nadia",
    handle: "@nadia",
    address: "0x5e8a1d4c7f0b3e6a9d2c5f8b1e4a7d0c3f6b9e2a",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces",
    verified: true,
  },
];

/** A few past transfers so the activity sheet has something to show. */
export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_demo_01",
    recipientId: "rcp_sarah",
    recipientName: "Sarah",
    recipientHandle: "@sarah",
    amountUnits: 4_250n,
    amountDisplay: "42.50",
    direction: "sent",
    status: "confirmed",
    kind: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 42),
  },
  {
    id: "tx_demo_02",
    recipientId: "rcp_jordan",
    recipientName: "Jordan",
    recipientHandle: "@jordan",
    amountUnits: 12_000n,
    amountDisplay: "120.00",
    direction: "received",
    status: "confirmed",
    kind: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
  {
    id: "tx_demo_03",
    recipientId: "rcp_emily",
    recipientName: "Emily",
    recipientHandle: "@emily",
    amountUnits: 1_899n,
    amountDisplay: "18.99",
    direction: "sent",
    status: "confirmed",
    kind: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
  },
  {
    id: "tx_demo_04",
    recipientId: "rcp_pavlo",
    recipientName: "Pavlo",
    recipientHandle: "@designwithpavlo",
    amountUnits: 60_000n,
    amountDisplay: "600.00",
    direction: "sent",
    status: "confirmed",
    kind: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "tx_demo_05",
    recipientId: "rcp_ravi",
    recipientName: "Ravi",
    recipientHandle: "@ravi",
    amountUnits: 25_500n,
    amountDisplay: "255.00",
    direction: "received",
    status: "confirmed",
    kind: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
  },
];

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

/**
 * Requests, in every state the list has to be able to draw.
 *
 * Deliberately not all "open". A list that only ever showed the pending case
 * would leave the declined, expired and settled appearances untested until
 * they happened to someone — and the settled one is wired to a real ledger id
 * so the request and the payment it became cannot describe different things.
 */
export const DEMO_REQUESTS: PaymentRequest[] = [
  {
    id: "req_demo_01",
    direction: "incoming",
    counterpartyId: "rcp_mia",
    counterpartyName: "Mia",
    counterpartyHandle: "@miamakes",
    amountUnits: 3_000n,
    note: "Dinner on Saturday",
    status: "open",
    kind: "demo",
    createdAt: new Date(Date.now() - HOUR * 3),
    expiresAt: new Date(Date.now() - HOUR * 3 + REQUEST_WINDOW_MS),
  },
  {
    id: "req_demo_02",
    direction: "outgoing",
    counterpartyId: "rcp_sarah",
    counterpartyName: "Sarah",
    counterpartyHandle: "@sarah",
    amountUnits: 7_500n,
    note: "Concert ticket",
    status: "open",
    kind: "demo",
    createdAt: new Date(Date.now() - HOUR * 5),
    expiresAt: new Date(Date.now() - HOUR * 5 + REQUEST_WINDOW_MS),
  },
  {
    // The same payment as `tx_demo_03`, seen from the other side. One event,
    // two records that agree about it.
    id: "req_demo_04",
    direction: "outgoing",
    counterpartyId: "rcp_emily",
    counterpartyName: "Emily",
    counterpartyHandle: "@emily",
    amountUnits: 1_899n,
    status: "paid",
    kind: "demo",
    createdAt: new Date(Date.now() - HOUR * 26),
    expiresAt: new Date(Date.now() - HOUR * 26 + REQUEST_WINDOW_MS),
    settledAt: new Date(Date.now() - HOUR * 26 + 1000 * 60 * 4),
    transactionId: "tx_demo_03",
  },
  {
    id: "req_demo_03",
    direction: "incoming",
    counterpartyId: "rcp_ravi",
    counterpartyName: "Ravi",
    counterpartyHandle: "@ravi",
    amountUnits: 1_250n,
    note: "Split the taxi",
    status: "open",
    kind: "demo",
    createdAt: new Date(Date.now() - HOUR * 26),
    expiresAt: new Date(Date.now() - HOUR * 26 + REQUEST_WINDOW_MS),
  },
  {
    id: "req_demo_06",
    direction: "incoming",
    counterpartyId: "rcp_taylor",
    counterpartyName: "Taylor",
    counterpartyHandle: "@taylor",
    amountUnits: 4_500n,
    note: "Birthday present",
    status: "declined",
    kind: "demo",
    createdAt: new Date(Date.now() - DAY * 2),
    expiresAt: new Date(Date.now() - DAY * 2 + REQUEST_WINDOW_MS),
    settledAt: new Date(Date.now() - DAY * 2 + HOUR * 6),
  },
  {
    // The request behind `ntf_demo_04` and `tx_demo_04`. Three records, one
    // event — which is the point of linking them rather than paraphrasing.
    id: "req_demo_07",
    direction: "outgoing",
    counterpartyId: "rcp_pavlo",
    counterpartyName: "Pavlo",
    counterpartyHandle: "@designwithpavlo",
    amountUnits: 60_000n,
    note: "Design deposit",
    status: "paid",
    kind: "demo",
    createdAt: new Date(Date.now() - DAY * 3),
    expiresAt: new Date(Date.now() - DAY * 3 + REQUEST_WINDOW_MS),
    settledAt: new Date(Date.now() - DAY * 3 + HOUR * 2),
    transactionId: "tx_demo_04",
  },
  {
    id: "req_demo_05",
    direction: "outgoing",
    counterpartyId: "rcp_nadia",
    counterpartyName: "Nadia",
    counterpartyHandle: "@nadia",
    amountUnits: 20_000n,
    note: "Studio deposit",
    status: "open",
    kind: "demo",
    // Left open on purpose: this one is older than the window, so the service
    // reports it as expired without anything having to change its status.
    createdAt: new Date(Date.now() - DAY * 8),
    expiresAt: new Date(Date.now() - DAY * 8 + REQUEST_WINDOW_MS),
  },
];
