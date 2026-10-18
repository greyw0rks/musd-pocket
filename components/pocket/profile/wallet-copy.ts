/**
 * What to say about the wallet, in one place.
 *
 * Two screens show wallet state — a personal Profile and a merchant's
 * Business — and they are looking at the same absence. Written twice, one of
 * them eventually starts saying something cheerier than the other, which is
 * exactly the failure Section 10 is guarding against: a wallet *interface* is
 * allowed before testnet, a claim that a funded on-chain wallet exists is not.
 *
 * So the words live here and both screens read them. `none` is the state a
 * user is in before Privy has minted anything, and it is written as a fact
 * rather than as a gap to fill in — there is no address to show, and no button
 * that would produce one. `ready` is the state a provisioned wallet is in, and
 * it may not say anything the app contradicts: the address *is* shown, on the
 * receive screen, because that is what receiving money requires.
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
    detail: "Ready. Your MUSD is held here, and payments are signed in the app.",
    badge: "Ready",
  },
};
