"use client";

import { Avatar } from "@/components/pocket/Avatar";
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
 * There is **one** balance and it lives in the user's wallet. The Wallet row and
 * the balance row below it describe the same address, which is the point: an
 * earlier build printed a Pocket ledger balance next to a separate on-chain
 * figure and had to explain the difference in a subtitle. There is no difference
 * to explain now — the number is the wallet's mUSD, and the row above it is the
 * wallet it is in.
 *
 * One of the four reference facts had to change. The reference prints a green
 * "Verified" pill, and verification is not a state this build can be in, because
 * there is no provider to verify against — so that row says what is actually the
 * case rather than decorating it.
 *
 * `Account type` is as the reference has it — genuinely known and genuinely
 * stable.
 */
export function AccountOverviewScreen({
  user,
  balance,
  wallet,
  network,
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
  /**
   * The wallet's mUSD, in minor units. The only balance there is.
   *
   * `null` until the chain read resolves — an absent reading is not a zero, and
   * `$0.00` over money the user may hold is the one wrong number this row can
   * print, so it prints a dash instead.
   */
  balance: bigint | null;
  /** The embedded wallet, as a status — see `WalletLink`. */
  wallet: WalletLink;
  /**
   * The chain the readings came from. Absent until the network read resolves.
   */
  network?: { name: string; chainId: number; wrongNetwork: boolean } | null;
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
        {/*
          The live reading, drawn only when a chain source answered. It is
          withheld rather than guessed in the window before the read resolves,
          and the balance row below is withheld the same way, for the same
          reason: both are readings, and neither has one yet.
        */}
        {network ? (
          <ListRow
            as="div"
            title="Network"
            trailing={
              network.wrongNetwork ? (
                <b className="text-[13px]">Not {network.name}</b>
              ) : (
                <span className="pk-row" style={{ gap: 6 }}>
                  <b className="text-[13px]">{network.name}</b>
                  <span className="pk-m">{network.chainId}</span>
                </span>
              )
            }
          />
        ) : null}
        <ListRow
          as="div"
          title="Total balance"
          subtitle="MUSD in your wallet."
          trailing={
            <b className="text-[13px]">
              {balance === null ? "—" : formatMoney(balance)}
            </b>
          }
        />
        {/*
          Not the reference's green pill. "Verified" is a claim about a provider
          having checked something, and no provider has checked anything here —
          so the row reports the state rather than decorating it.
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
