"use client";

import { useState } from "react";
import {
  AtSignIcon,
  BellIcon,
  BriefcaseIcon,
  EditIcon,
  MailIcon,
  OutIcon,
  VaultIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { TextField } from "@/components/pocket/ui/TextField";
import { Toggle } from "@/components/pocket/ui/Toggle";
import { ReceiptsSheet } from "@/components/pocket/profile/ReceiptsSheet";
import { WALLET_COPY } from "@/components/pocket/profile/wallet-copy";
import { RECEIPTS_CHANNEL_LABEL } from "@/features/session/session.types";

/**
 * Business settings (Section 6, screen 34).
 *
 * Everything a business configures about itself once, rather than acts on.
 * It is the counterpart of screen 28: the profile is what a customer sees, and
 * this is what the owner changes.
 *
 * The rows are ordered by how real they are. Name and handle genuinely change
 * and genuinely persist — those are the same calls onboarding makes, so there
 * is no second write path. Receipts genuinely connect and revoke. Payouts and
 * alerts have nothing behind them yet, and the rows say which is which rather
 * than presenting four switches that all pretend to work.
 */
export function MerchantSettingsScreen({ onBack }: { onBack: () => void }) {
  const { session, saveProfile, checkHandle, signOut } = usePocket();

  const user = session?.user;
  const wallet = session?.wallet;

  const [editing, setEditing] = useState<"name" | "handle" | null>(null);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [confirmingOut, setConfirmingOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [alerts, setAlerts] = useState(true);

  const receipts = user?.receipts;

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Business settings" onBack={onBack} />

      <div className="space-y-5">
        <ListGroup label="Business">
          <ListRow
            leading={<BriefcaseIcon size={16} className="pk-m" />}
            title="Business name"
            subtitle={user?.businessName || user?.name || "Not set"}
            trailing={<EditIcon size={14} className="pk-m" />}
            onPress={() => setEditing("name")}
          />
          <ListRow
            leading={<AtSignIcon size={16} className="pk-m" />}
            title="Username"
            subtitle={
              user?.handle
                ? `${user.handle} — what a payment code carries.`
                : "Not set"
            }
            trailing={<EditIcon size={14} className="pk-m" />}
            onPress={() => setEditing("handle")}
          />
        </ListGroup>

        <ListGroup label="Money">
          <ListRow
            leading={<MailIcon size={16} className="pk-m" />}
            title="Receipts"
            subtitle={
              receipts
                ? `${RECEIPTS_CHANNEL_LABEL[receipts.channel]} connected.`
                : "Not connected. No copies are being sent."
            }
            onPress={() => setReceiptsOpen(true)}
          />
          <ListRow
            as="div"
            leading={<VaultIcon size={16} className="pk-m" />}
            title="Payouts"
            subtitle={WALLET_COPY[wallet?.status ?? "none"].detail}
            trailing={<span className="pk-pill pk-pill--warn">Not wired</span>}
          />
        </ListGroup>

        {/*
          One working switch and one that is not. The enabled one is real state
          in this component; the payouts row above is the honest "no" that sits
          beside it so the pair reads as a distinction rather than an oversight.
        */}
        <ListGroup label="Notifications">
          <ListRow
            as="div"
            leading={<BellIcon size={16} className="pk-m" />}
            title="Payment alerts"
            subtitle={
              alerts
                ? "Tell me when a payment comes in."
                : "Silent. The Payments tab still fills up."
            }
            trailing={
              <Toggle
                checked={alerts}
                onChange={setAlerts}
                label="Payment alerts"
              />
            }
          />
        </ListGroup>

        <ListGroup label="Account">
          <ListRow
            as="div"
            leading={<VaultIcon size={16} className="pk-m" />}
            title={WALLET_COPY[wallet?.status ?? "none"].title}
            subtitle={WALLET_COPY[wallet?.status ?? "none"].detail}
            trailing={
              <span className="pk-pill">
                {WALLET_COPY[wallet?.status ?? "none"].badge}
              </span>
            }
          />
          <ListRow
            leading={<OutIcon size={16} className="pk-m" />}
            title="Sign out"
            subtitle="Leaves the demo account signed in on this device."
            onPress={() => setConfirmingOut(true)}
          />
        </ListGroup>

        <p className="pk-m px-1 pb-2 leading-relaxed">
          Business name and username are stored on this device. Nothing here
          touches a payment network.
        </p>
      </div>

      <EditFieldSheet
        field={editing}
        initial={
          editing === "handle"
            ? (user?.handle ?? "")
            : (user?.businessName || user?.name || "")
        }
        onClose={() => setEditing(null)}
        onSave={saveProfile}
        checkHandle={checkHandle}
      />

      <ReceiptsSheet open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

      <Sheet
        open={confirmingOut}
        onClose={() => setConfirmingOut(false)}
        title="Sign out?"
      >
        <p className="pk-m text-center leading-relaxed">
          The demo account stays on this device — signing back in with X brings
          the same balance and history back.
        </p>
        <div className="mt-5 space-y-2">
          <Button
            full
            size="lg"
            variant="danger"
            loading={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().then(() => setSigningOut(false));
            }}
          >
            Sign out
          </Button>
          <Button
            full
            size="lg"
            variant="secondary"
            disabled={signingOut}
            onClick={() => setConfirmingOut(false)}
          >
            Stay signed in
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * Edit one text field.
 *
 * The handle is checked before it is taken, through the same `checkHandle` the
 * sign-up screen uses — a business renaming itself is exactly the moment two
 * businesses would collide, so the check cannot be a sign-up-only courtesy.
 */
function EditFieldSheet({
  field,
  initial,
  onClose,
  onSave,
  checkHandle,
}: {
  field: "name" | "handle" | null;
  initial: string;
  onClose: () => void;
  onSave: (update: { businessName?: string; handle?: string }) => Promise<string | null>;
  checkHandle: (handle: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);

  // The sheet is reused for two fields, so a value typed into one must not
  // follow the user into the other.
  if (field !== null && seen !== field) {
    setSeen(field);
    setValue(initial);
    setError(null);
  }

  const isHandle = field === "handle";
  const label = isHandle ? "Username" : "Business name";

  async function save() {
    if (field === null || busy) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError(
        isHandle ? "A username is required." : "A business name is required.",
      );
      return;
    }

    setBusy(true);
    setError(null);

    if (isHandle) {
      const problem = await checkHandle(trimmed);
      if (problem) {
        setBusy(false);
        setError(problem);
        return;
      }
    }

    const failure = await onSave(
      isHandle ? { handle: trimmed } : { businessName: trimmed },
    );
    setBusy(false);

    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  }

  return (
    <Sheet open={field !== null} onClose={onClose} title={label}>
      <TextField
        label={label}
        value={value}
        error={error ?? undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
        }}
      />
      <p className="pk-m mt-2 px-1 leading-relaxed">
        {isHandle
          ? "The username is what a payment code carries and what a customer sees before they confirm."
          : "The name a customer sees on your payment code and on their receipt."}
      </p>
      <Button
        full
        size="lg"
        className="mt-4"
        loading={busy}
        disabled={value.trim().length === 0}
        onClick={() => void save()}
      >
        Save
      </Button>
    </Sheet>
  );
}
