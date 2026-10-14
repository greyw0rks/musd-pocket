"use client";

import { Avatar } from "@/components/pocket/Avatar";
import {
  BellIcon,
  LockIcon,
  MoonIcon,
  OutIcon,
  QrIcon,
  UserIcon,
  UsersIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { usePocketTheme } from "@/components/pocket/theme-mode";
import type { PocketTheme } from "@/components/pocket/theme-mode";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
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
 * The security section is a sentence rather than a list of switches. The
 * reference offers Face ID and a passcode, and neither exists here: the
 * session is a demo object and there is no wallet behind it to unlock. A
 * toggle that turns nothing on is worse than a row that says so.
 *
 * The account rows all lead somewhere real — the account overview, the
 * payment code, the contact list — so nothing on this screen is a dead tap.
 */
export function SettingsScreen({
  user,
  onBack,
  onOpenAccount,
  onOpenContacts,
  onOpenReceive,
  onSignOut,
}: {
  user: { name: string; handle: string; accountType: AccountType };
  onBack: () => void;
  onOpenAccount: () => void;
  onOpenContacts: () => void;
  onOpenReceive: () => void;
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
        </div>
      </section>

      <section className="pk-group">
        <p className="pk-m font-semibold uppercase">Security</p>
        <div className="pk-card" style={{ padding: "16px 20px" }}>
          <div className="pk-row" style={{ gap: 12, alignItems: "flex-start" }}>
            <span className="pk-ico" style={{ flex: "none" }}>
              <LockIcon size={18} />
            </span>
            <div>
              <b className="text-[14px]">This build is not protected</b>
              <p className="pk-m" style={{ marginTop: 2 }}>
                Sign-in is mocked, so there is no passcode or biometric to set
                up and no key stored on this device. Nothing here is holding
                real money.
              </p>
            </div>
          </div>
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
