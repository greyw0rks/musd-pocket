"use client";

import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import { GearIcon } from "@/components/pocket/icons";
import { motion } from "motion/react";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import type { AccountType, WalletLink } from "@/features/session/session.types";
import { formatMoney } from "@/lib/formatters";
import { shortenAddress } from "@/lib/utils";

/**
 * Account overview.
 *
 * The reference's `acct` screen: a centred portrait, the name and handle, four
 * facts about the account, and a way to edit it.
 *
 * Two of the four facts had to change, and both changes are the same change —
 * the reference prints a balance and a green "Verified" pill, and neither is
 * true here. The balance is the demo ledger's, so it is labelled as demo
 * rather than presented as a fact about a wallet; and verification is not a
 * state this build can be in, because there is no provider to verify against,
 * so the row says what is actually the case.
 *
 * `Account type` is as the reference has it — genuinely known and genuinely
 * stable.
 *
 * The Wallet row is not. It used to be a hardcoded "not connected", which was
 * true of the fixtures and is false of `/home`, where the row sits directly
 * above a real balance drawn from a wallet that is very much connected. It
 * reads the session's wallet link now, so the row and the number below it
 * cannot disagree about whether there is a wallet.
 */
export function AccountOverviewScreen({
  user,
  balance,
  wallet,
  onBack,
  onEditProfile,
  onOpenSettings,
}: {
  user: {
    name: string;
    handle: string;
    avatarUrl?: string;
    accountType: AccountType;
  };
  balance: bigint;
  /** The embedded wallet, as a status — see `WalletLink`. */
  wallet: WalletLink;
  onBack: () => void;
  onEditProfile: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Account overview"
        onBack={onBack}
        action={
          /*
            Settings lives behind this gear as well as behind the Profile row,
            because Appearance is on it and Appearance is what decides whether
            the user is looking at a white app or a black one. A control that
            changes how the whole app looks should not be more than two taps
            from wherever the user already is.
          */
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="pk-ib outline-none"
          >
            <GearIcon size={20} />
          </motion.button>
        }
      />

      <div
        className="flex flex-col items-center justify-center gap-1"
        style={{ minHeight: 200 }}
      >
        <Avatar name={user.name} src={user.avatarUrl} size={88} />
        <h2 className="pk-h2" style={{ marginTop: 8 }}>
          {user.name}
        </h2>
        <span className="pk-m">{user.handle}</span>
      </div>

      <ListGroup>
        <ListRow
          as="div"
          title="Account type"
          trailing={
            <b className="text-[13px]">
              {user.accountType === "merchant" ? "Merchant" : "Personal"}
            </b>
          }
        />
        <ListRow
          as="div"
          title="Wallet"
          trailing={
            <span className="pk-row" style={{ gap: 6 }}>
              <b className="text-[13px]">MUSD</b>
              {/*
                The address rather than the word "connected": the two are the
                same claim and only one of them can be checked by the person
                reading it.
              */}
              <span className="pk-m">
                {wallet.status === "ready" && wallet.address
                  ? shortenAddress(wallet.address)
                  : wallet.status === "provisioning"
                    ? "preparing"
                    : "not connected"}
              </span>
            </span>
          }
        />
        <ListRow
          as="div"
          title="Total balance"
          trailing={
            <span className="pk-row" style={{ gap: 6 }}>
              <DemoBadge />
              <b className="text-[13px]">{formatMoney(balance)}</b>
            </span>
          }
        />
        {/*
          Not the reference's green pill. "Verified" is a claim about a provider
          having checked something, and no provider has checked anything in
          this build — the sign-in is a demo object, so the row reports the
          state rather than decorating it.
        */}
        <ListRow
          as="div"
          title="Verification"
          trailing={<span className="pk-m">Not available yet</span>}
        />
      </ListGroup>

      <Button variant="secondary" full className="mt-5" onClick={onEditProfile}>
        Edit profile
      </Button>
    </div>
  );
}
