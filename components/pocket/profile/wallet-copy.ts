/**
 * What to say about the wallet, in one place.
 *
 * Two screens now show wallet state — a personal Profile and a merchant's
 * Business — and they are looking at the same absence. Written twice, one of
 * them eventually starts saying something cheerier than the other, which is
 * exactly the failure Section 10 is guarding against: a wallet *interface* is
 * allowed before testnet, a claim that a funded on-chain wallet exists is not.
 *
 * So the words live here and both screens read them. `none` is the state the
 * demo is permanently in, and it is written as a fact rather than as a gap to
 * fill in — there is no address to show, and no button that would produce one.
 */

import type { WalletStatus } from "@/features/session/session.types";

export const WALLET_COPY: Record<
  WalletStatus,
  { title: string; detail: string; badge: string }
> = {
  none: {
    title: "Embedded wallet",
    detail: "No wallet exists yet, so there is no address.",
    badge: "Not connected",
  },
  provisioning: {
    title: "Embedded wallet",
    detail: "Being set up. There is nothing to show until it finishes.",
    badge: "Setting up",
  },
  ready: {
    title: "Embedded wallet",
    detail: "Ready. The address stays inside the app and is never displayed.",
    badge: "Ready",
  },
};
