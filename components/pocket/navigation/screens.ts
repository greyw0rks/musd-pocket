import type { ScreenId } from "@/components/pocket/navigation/ids";

export type PocketTab = "home" | "swap" | "wealth";

/** The tabs, left to right, in the order the dock draws them. */
export const DOCK_TABS: readonly PocketTab[] = ["home", "swap", "wealth"];

/** What each tab says on the pill and in its accessible name. */
export const TAB_LABELS: Record<PocketTab, string> = {
  home: "Home",
  wealth: "Wealth",
  swap: "Swap",
};

/**
 * The screens the dock sits under.
 *
 * Only tops are listed. A screen pushed from one — a receipt, a contact list, a
 * send sheet — has its own way back, and a dock under it would offer a second,
 * competing one.
 */
const DOCK_OWNERS: readonly ScreenId[] = ["home", "swap", "wealth"];

/**
 * A pushed screen that still *belongs* to a tab.
 *
 * Transaction history is reached from Home. Vault, locks and pools belong to
 * Wealth. Pushed screens have their own Back control.
 */
const TAB_BY_SCREEN: Partial<Record<ScreenId, PocketTab>> = {
  home: "home",
  swap: "swap",
  wealth: "wealth",
  vault: "wealth",
  locks: "wealth",
  pools: "wealth",
  transactions: "home",
  transaction: "home",
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
  if (tab === "wealth") return "wealth";
  if (tab === "swap") return "swap";
  return "home";
}
