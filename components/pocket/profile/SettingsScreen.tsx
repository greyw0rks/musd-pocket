"use client";

import { Avatar } from "@/components/pocket/Avatar";
import {
  BellIcon,
  HelpIcon,
  LockIcon,
  MoonIcon,
  OutIcon,
  QrIcon,
  SendIcon,
  UserIcon,
  UsersIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { usePocketTheme } from "@/components/pocket/theme-mode";
import type { PocketTheme } from "@/components/pocket/theme-mode";
import { PasskeyCard } from "@/components/pocket/profile/PasskeyCard";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { hasPrivy } from "@/lib/wallet/privy";
import { TOUR_STEPS } from "@/components/pocket/walkthrough/tour";
import type { AccountType } from "@/features/session/session.types";

const THEMES: readonly { id: PocketTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

/**
 * Settings.
 *
 * The reference's screen, with its four sections kept — identity, account,
 * preferences, security — and one of them doing real work.
 *
 * Appearance is the honest one. The reference has a single "Dark mode"
 * toggle; this has three positions, because "follow the phone" is a different
 * choice from "always dark" and a two-state switch cannot express it. The
 * choice is written to storage and survives a reload.
 *
 * The security section used to be a sentence saying there was no lock here at
 * all. Half of that is still true and half of it is now wrong. Pocket still
 * holds no key and sets no passcode of its own — but the wallet's confirmation
 * sheet has been turned off in favour of a passkey, so there *is* a gate on the
 * money, and whether it is closed depends on whether the user has enrolled.
 * That is a state, not a sentence, which is why this section is now a component
 * (`PasskeyCard`) that reads the real enrolment and says which case you are in.
 *
 * The gate is deliberate about which stack it runs on. The passkey only exists
 * where Privy does, so the card is rendered behind `hasPrivy()` — below it, the
 * fallback stack signs in through a browser wallet, whose own confirmation is
 * the only gate there has ever been, and the card would be describing a control
 * that is not on the screen.
 *
 * The account rows all lead somewhere real — the account overview, the
 * payment code, the contact list — so nothing on this screen is a dead tap.
 *
 * The Bitcoin group is the newest one and the odd one out: every other row here
 * opens a view or a preference, and that one moves money. It is a group of its
 * own rather than a fourth account row for exactly that reason — a transfer
 * with no undo does not belong between "Saved contacts" and "Sign out" — and it
 * is where the user asked for it, on this screen rather than on a vault.
 */
export function SettingsScreen({
  user,
  onBack,
  onOpenAccount,
  onOpenContacts,
  onOpenReceive,
  onOpenWithdrawBtc,
  onStartTour,
  onSignOut,
}: {
  user: { name: string; handle: string; accountType: AccountType };
  onBack: () => void;
  onOpenAccount: () => void;
  onOpenContacts: () => void;
  onOpenReceive: () => void;
  onOpenWithdrawBtc: () => void;
  /**
   * Replays the first-run walkthrough. It goes up to the host rather than
   * starting the tour here, because every step points at a Home element and
   * this screen is not Home — the host resets to Home and opens the tour on the
   * screen the tour is about.
   */
  onStartTour: () => void;
  onSignOut: () => void;
}) {
  const { theme, resolved, setTheme } = usePocketTheme();

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <div className="pk-row" style={{ margin: "6px 0 4px" }}>
        <Avatar name={user.name} size={64} />
        <div className="min-w-0">
          <h2 className="pk-h2 truncate">{user.name}</h2>
          <span className="pk-m">
            {user.handle} ·{" "}
            {user.accountType === "merchant" ? "Merchant" : "Personal"}
          </span>
        </div>
      </div>

      <ListGroup label="Account">
        <ListRow
          leading={<span className="pk-ico"><UserIcon size={18} /></span>}
          title="Profile & account overview"
          onPress={onOpenAccount}
        />
        <ListRow
          leading={<span className="pk-ico"><QrIcon size={18} /></span>}
          title="Payment QR & username"
          onPress={onOpenReceive}
        />
        <ListRow
          leading={<span className="pk-ico"><UsersIcon size={18} /></span>}
          title="Saved contacts"
          onPress={onOpenContacts}
        />
      </ListGroup>

      {/*
        Bitcoin gets its own group rather than a fourth row in Account, because
        it is the one thing on this screen that moves money. Burying a transfer
        among profile rows is how it gets pressed by accident — and this one has
        no take-back and no undo.
      */}
      <ListGroup label="Bitcoin">
        <ListRow
          leading={<span className="pk-ico"><SendIcon size={18} /></span>}
          title="Send BTC to an address"
          subtitle="Mezo's gas token, straight to any wallet address"
          onPress={onOpenWithdrawBtc}
        />
      </ListGroup>

      <section className="pk-group">
        <p className="pk-m font-semibold uppercase">Preferences</p>
        <div className="pk-card !px-4 !py-0">
          <div className="pk-li pk-li--static" style={{ display: "block" }}>
            <div className="pk-row pk-sp" style={{ marginBottom: 10 }}>
              <span className="pk-row" style={{ gap: 12 }}>
                <span className="pk-ico"><MoonIcon size={18} /></span>
                <b className="text-[14px]">Appearance</b>
              </span>
              <span className="pk-m">
                {resolved === "dark" ? "Dark" : "Light"}
              </span>
            </div>

            {/*
              Three positions rather than a switch. `aria-pressed` marks the
              choice the user made — System stays pressed when the phone is
              dark, because "follow the phone" is the setting, not "dark".
            */}
            <div className="pk-chips" style={{ margin: 0, padding: 0 }}>
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  aria-pressed={theme === option.id}
                  className={`pk-chip ${theme === option.id ? "pk-chip--on" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <ListRow
            leading={<span className="pk-ico"><BellIcon size={18} /></span>}
            title="Notifications"
            onPress={onOpenAccount}
          />

          {/* The tour, where someone looks for it after skipping it in a hurry.
              The count is read off the step list rather than written here, so
              adding a step cannot leave this sentence lying. */}
          <ListRow
            leading={<span className="pk-ico"><HelpIcon size={18} /></span>}
            title="Take the tour"
            subtitle={`Where everything lives, in ${TOUR_STEPS.length} steps`}
            onPress={onStartTour}
          />
        </div>
      </section>

      <section className="pk-group">
        <p className="pk-m font-semibold uppercase">Security</p>
        {/*
          The tour's last stop. The wrapper covers both branches so the
          spotlight lands on the card whether or not a passkey can be enrolled —
          and on a build without Privy the card says so rather than the step
          pointing at nothing.
        */}
        <div data-tour="passkey">
          {hasPrivy() ? (
            <PasskeyCard />
          ) : (
            <div className="pk-card" style={{ padding: "16px 20px" }}>
              <div className="pk-row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="pk-ico" style={{ flex: "none" }}>
                  <LockIcon size={18} />
                </span>
                <div>
                  <b className="text-[14px]">Your browser wallet is the gate</b>
                  <p className="pk-m" style={{ marginTop: 2 }}>
                    Pocket holds no key and sets no passcode of its own. This build
                    signs in through a wallet in your browser, so the confirmation
                    that wallet shows you is what stands in front of a transfer.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <ListGroup>
        <ListRow
          leading={<span className="pk-ico"><OutIcon size={18} /></span>}
          title="Sign out"
          onPress={onSignOut}
        />
      </ListGroup>
    </div>
  );
}
