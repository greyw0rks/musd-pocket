/**
 * Demo notifications.
 *
 * Fictional, like everything else in `data/`. Two of them point at seeded
 * ledger entries so the tap-through is real — the screen opens the actual
 * receipt rather than a copy of one.
 *
 * The security notice is deliberately in the list. A notification screen that
 * only ever carries good news is a notification screen nobody reads, and the
 * one entry that asks the user to do something is the one that has to look
 * different from the rest.
 */

import type { PocketNotification } from "@/features/notifications/notification.types";

export const DEMO_NOTIFICATIONS: PocketNotification[] = [
  {
    id: "ntf_demo_01",
    kind: "payment_received",
    title: "Jordan paid you $120.00",
    body: "Received to your MUSD balance.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    read: false,
    transactionId: "tx_demo_02",
  },
  {
    id: "ntf_demo_02",
    kind: "payment_sent",
    title: "You sent Sarah $42.50",
    body: "Sent from your MUSD balance.",
    createdAt: new Date(Date.now() - 1000 * 60 * 42),
    read: false,
    transactionId: "tx_demo_01",
  },
  {
    id: "ntf_demo_03",
    kind: "security",
    title: "Review your sign-in methods",
    body: "This demo has one mock provider and no password. Wired to a real provider, this is where a second factor would be offered.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    read: true,
  },
  {
    id: "ntf_demo_06",
    kind: "request_received",
    title: "Mia asked you for $30.00",
    body: "Dinner on Saturday. Nothing moves until you pay it.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    read: false,
    requestId: "req_demo_01",
  },
  {
    id: "ntf_demo_04",
    kind: "request_paid",
    title: "Pavlo paid your request",
    body: "Your request for $600.00 was paid in full.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    read: true,
    transactionId: "tx_demo_04",
    requestId: "req_demo_07",
  },
  {
    id: "ntf_demo_05",
    kind: "product",
    title: "Payments are not live yet",
    body: "Balances here are seeded and transfers stay inside this app. Mezo testnet wiring is the next step.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
    read: true,
  },
];
