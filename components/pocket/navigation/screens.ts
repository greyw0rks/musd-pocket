/**
 * Which screens own the dock, and what the dock switches between.
 *
 * The dock is three tops, and a top is a screen with nothing above it: you
 * arrive from the dock, you leave by the dock, and there is nothing to go
 * *back* to. That is the whole rule, and it is why this module exists rather
 * than each screen deciding for itself — `dockForScreen` is the single answer
 * to "is there a bar under this?", and a screen in the dock with no entry here
 * would render a bar whose current tab is nothing.
 *
 * **A tab switch is a reset, not a push.** `screenForTab` returns the screen a
 * tab means and the caller resets the stack to it, so tapping Vault and then
 * Home does not leave a Home→Vault→Home history behind it. Back out of a tab
 * top and there is nowhere to go, which is what a tab top is.
 *
 * Three tabs, and each one is a thing the app can actually do:
 *
 *  - **Home** — the balance, the verbs, the last few payments.
 *  - **Vault** — MUSD deposited into Mezo's Savings Vault, earning.
 *  - **Spending** — the ledger: every payment this account has made or taken.
 *
 * There was a dock before and it was deliberately emptied: `dockTabs` returned
 * `[]` for the real app, because Vault and Spending were fixtures over a
 * borrow feature that had no server and a spending summary of payments that
 * did not exist. Both are now backed by real reads — the vault by the Mezo
 * Savings Vault on chain 31611, Spending by the payments table — so the reason
 * the dock was empty is gone rather than overridden.
 *
 * The merchant dock that lived here is not returning with it. `accountType` is
 * hardcoded to `personal` in the live session adapter, so a merchant tab set
 * would be a second set of tabs nothing can reach.
 */

import type { ScreenId } from "@/components/pocket/navigation/ids";

export type PocketTab = "home" | "vault" | "spending";

/** The tabs, left to right, in the order the dock draws them. */
export const DOCK_TABS: readonly PocketTab[] = ["home", "vault", "spending"];

/** What each tab says on the pill and in its accessible name. */
export const TAB_LABELS: Record<PocketTab, string> = {
  home: "Home",
  vault: "Vault",
  spending: "Spending",
};

/**
 * The screens the dock sits under.
 *
 * Only tops are listed. A screen pushed from one — a receipt, a contact list, a
 * send sheet — has its own way back, and a dock under it would offer a second,
 * competing one.
 */
const DOCK_OWNERS: readonly ScreenId[] = ["home", "vault", "transactions"];

/**
 * A pushed screen that still *belongs* to a tab.
 *
 * `transaction` is reached from Spending and from Home, and on the way back it
 * is Spending or Home that should look current, not nothing. It does not own a
 * dock — `DOCK_OWNERS` decides that — it only borrows Spending's lit pill for
 * as long as it is on top of a screen that does.
 */
const TAB_BY_SCREEN: Partial<Record<ScreenId, PocketTab>> = {
  home: "home",
  vault: "vault",
  transactions: "spending",
  transaction: "spending",
};

/** Whether this screen draws the dock. */
export function dockForScreen(id: ScreenId): boolean {
  return DOCK_OWNERS.includes(id);
}

/** Which tab reads as current on this screen — `null` when no tab owns it. */
export function tabForScreen(id: ScreenId): PocketTab | null {
  return TAB_BY_SCREEN[id] ?? null;
}

/** Where a tab goes. The caller resets the stack to this. */
export function screenForTab(tab: PocketTab): ScreenId {
  if (tab === "vault") return "vault";
  if (tab === "spending") return "transactions";
  return "home";
}
