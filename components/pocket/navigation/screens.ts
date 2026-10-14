/**
 * Which screens the dock owns, and how a tab maps back to a screen.
 *
 * The personal dock is the one the product was drawn around: Home, Vault,
 * Spending. It is not a list of every destination — sending, requesting,
 * borrowing and the ledger are all things you *do* from Home, and each of them
 * is a pushed screen with a way back, so this returns null for them and the
 * dock gets out of the way.
 *
 * The merchant dock keeps its own three, because a merchant's world is money
 * arriving rather than money set aside, and the two sets genuinely differ.
 *
 * Kept out of the store so that navigation rules can be reasoned about — and
 * unit-tested — without mounting React.
 */

import type { ScreenId } from "@/components/pocket/navigation/ids";
import type { AccountType } from "@/features/session/session.types";

export type PocketTab =
  | "home"
  | "vault"
  | "spending"
  | "payments"
  | "business";
export type DockRole = "personal" | "merchant";

/** Which dock, if any, this screen shows. */
export function dockForScreen(
  id: ScreenId,
  accountType: AccountType,
): DockRole | null {
  if (accountType === "merchant") {
    if (id === "merchant-home") return "merchant";
    if (id === "merchant-payments") return "merchant";
    if (id === "merchant-profile") return "merchant";
    return null;
  }

  if (id === "home" || id === "vault" || id === "spending") return "personal";
  return null;
}

/** Which tab should read as current. */
export function tabForScreen(
  id: ScreenId,
  accountType: AccountType,
): PocketTab | null {
  if (accountType === "merchant") {
    if (id === "merchant-home") return "home";
    if (id === "merchant-payments") return "payments";
    if (id === "merchant-profile") return "business";
    return null;
  }

  if (id === "home") return "home";
  if (id === "vault") return "vault";
  if (id === "spending") return "spending";
  return null;
}

/** Where a dock tab goes. */
export function screenForTab(
  tab: PocketTab,
  accountType: AccountType,
): ScreenId {
  if (accountType === "merchant") {
    if (tab === "payments") return "merchant-payments";
    if (tab === "business") return "merchant-profile";
    return "merchant-home";
  }

  if (tab === "vault") return "vault";
  if (tab === "spending") return "spending";
  return "home";
}

/**
 * The screen a signed-in user should land on.
 *
 * A merchant's Home is the dashboard, not the personal home — the whole point
 * of the role fork is that the first screen after onboarding already differs.
 */
export function homeScreenFor(accountType: AccountType): ScreenId {
  return accountType === "merchant" ? "merchant-home" : "home";
}
