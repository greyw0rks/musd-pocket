"use client";

import { ExternalLink } from "lucide-react";
import { getAddress } from "viem";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { explorer } from "@/lib/mezo/explorer";
import {
  MUSD_ADDRESS,
  MUSD_SYMBOL,
  ACTIVE_ENV,
  activeChain,
} from "@/lib/mezo/config";
import { chainLabel } from "@/lib/chain-display";
import { shortenAddress } from "@/lib/utils";

export default function SettingsPage() {
  const { user, walletAddress, logout } = useSession();

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="mb-5 text-xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      <Card className="px-4">
        <Row label="Username">
          {user ? (
            <span className="font-medium text-foreground">
              @{user.username}
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Wallet">
          {walletAddress ? (
            <span className="technical text-[13px] text-foreground">
              {shortenAddress(getAddress(walletAddress), 6)}
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="X (Twitter)">
          {user?.xHandle ? `@${user.xHandle}` : "Not connected"}
        </Row>
        <Row label="Telegram">
          {user?.telegramHandle ? `@${user.telegramHandle}` : "Not connected"}
        </Row>
        <Row label="Default chain">
          {user ? chainLabel(user.preferredChain) : "—"}
        </Row>
      </Card>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-muted">Network</h2>
      <Card className="px-4">
        <Row label="Environment">
          <span className="font-medium capitalize text-foreground">
            {ACTIVE_ENV} · chain {activeChain.id}
          </span>
        </Row>
        <Row label={`${MUSD_SYMBOL} token`}>
          <a
            href={explorer.token(MUSD_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="technical inline-flex items-center gap-1 text-[13px] text-primary"
          >
            {shortenAddress(MUSD_ADDRESS)} <ExternalLink className="size-3" />
          </a>
        </Row>
      </Card>

      <div className="mt-8">
        <Button variant="secondary" fullWidth onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
