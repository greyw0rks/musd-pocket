"use client";

import { getAddress } from "viem";
import { Wallet as WalletIcon, AtSign, Send } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { AddressDisplay } from "@/components/address-display";
import { chainLabel } from "@/lib/chain-display";
import { formatAmount } from "@/lib/utils";
import { MUSD_SYMBOL } from "@/lib/mezo/config";

export default function WalletPage() {
  const { user, walletAddress } = useSession();
  if (!user) return null;

  const checksummed = walletAddress ? getAddress(walletAddress) : "";

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Wallet
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your non-custodial embedded wallet and connected accounts.
        </p>
      </header>

      {/* Balances */}
      <Card>
        <CardBody className="space-y-4">
          <BalanceRow
            label="Available"
            value={formatAmount(user.availableBalance)}
          />
          <div className="h-px bg-border" />
          <BalanceRow
            label="In flight"
            value={formatAmount(user.frozenBalance)}
            muted
          />
        </CardBody>
      </Card>

      {/* Embedded wallet address */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <WalletIcon className="size-4 text-primary" />
            Embedded wallet
          </div>
          {walletAddress && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
              <span className="technical truncate text-[13px] text-foreground">
                {checksummed}
              </span>
              <CopyButton value={checksummed} label="Copy" />
            </div>
          )}
          <p className="mt-2 text-[13px] text-muted">
            Default chain: {chainLabel(user.preferredChain)}
          </p>
        </CardBody>
      </Card>

      {/* Connected accounts */}
      <Card>
        <CardBody>
          <p className="text-sm font-semibold text-foreground">
            Connected accounts
          </p>
          <div className="mt-3 space-y-2">
            <AccountRow
              icon={AtSign}
              label="X (Twitter)"
              value={user.xHandle ? `@${user.xHandle}` : "Not connected"}
              connected={Boolean(user.xHandle)}
            />
            <AccountRow
              icon={Send}
              label="Telegram"
              value={
                user.telegramHandle
                  ? `@${user.telegramHandle}`
                  : "Not connected"
              }
              connected={Boolean(user.telegramHandle)}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function BalanceRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={
          muted
            ? "tabular text-lg font-medium text-muted"
            : "tabular text-2xl font-semibold text-foreground"
        }
      >
        {value}{" "}
        <span className="text-sm font-normal text-muted">{MUSD_SYMBOL}</span>
      </span>
    </div>
  );
}

function AccountRow({
  icon: Icon,
  label,
  value,
  connected,
}: {
  icon: typeof AtSign;
  label: string;
  value: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-foreground">
        <Icon className="size-4 text-muted" />
        {label}
      </span>
      <span
        className={
          connected
            ? "text-[13px] font-medium text-foreground"
            : "text-[13px] text-muted"
        }
      >
        {value}
      </span>
    </div>
  );
}
