"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, ArrowDownLeft } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { useApi } from "@/lib/auth/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeView } from "@/components/ui/qr-code";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { AddressDisplay } from "@/components/address-display";
import { hasVault, getVaultAddress } from "@/lib/mezo/vault";
import { MUSD_SYMBOL } from "@/lib/mezo/config";
import { chainLabel } from "@/lib/chain-display";
import { formatAmount, relativeTime } from "@/lib/utils";

type DepositRow = {
  id: string;
  amount: string;
  txHash: string;
  status: string;
  createdAt: string;
};

const NETWORKS = ["MEZO", "BASE", "ETHEREUM"] as const;

export default function DepositPage() {
  const { refresh } = useSession();
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [network] = useState<(typeof NETWORKS)[number]>("MEZO");

  const vault = hasVault() ? getVaultAddress() : null;

  const deposits = useQuery({
    queryKey: ["deposits"],
    queryFn: () => api<{ deposits: DepositRow[] }>("/api/deposits"),
  });

  const scan = useMutation({
    mutationFn: () => api<{ credited: number; amount: string }>("/api/deposits", { method: "POST" }),
    onSuccess: async (res) => {
      if (res.credited > 0) {
        toast("success", `Added ${formatAmount(res.amount)} ${MUSD_SYMBOL} to your Pocket`);
      } else {
        toast("info", "No new deposits found yet. Give it a moment and check again.");
      }
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ["deposits"] }),
      ]);
    },
    onError: (e) => toast("error", e instanceof Error ? e.message : "Could not check for deposits"),
  });

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Plus className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Add money</h1>
          <p className="text-sm text-muted">Send MUSD to your vault and it credits your balance.</p>
        </div>
      </header>

      {/* Network — only Mezo is live; others are modeled for now. */}
      <div className="flex gap-2">
        {NETWORKS.map((n) => {
          const active = n === network;
          const live = n === "MEZO";
          return (
            <span
              key={n}
              className={
                active
                  ? "rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted"
              }
            >
              {chainLabel(n)}
              {!live && " · soon"}
            </span>
          );
        })}
      </div>

      {!vault ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Plus}
              title="Deposits are warming up"
              description="The Pocket vault address isn't configured yet. Restart the server with NEXT_PUBLIC_POCKET_VAULT_ADDRESS set."
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <QRCodeView value={vault} />
            <div>
              <p className="text-sm text-muted">Your {chainLabel(network)} vault address</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <AddressDisplay address={vault} chars={6} link={false} />
                <CopyButton value={vault} label="Copy" />
              </div>
            </div>
            <p className="max-w-sm text-[13px] text-muted">
              Send {MUSD_SYMBOL} from your wallet to this address. Then tap below — Pocket detects
              the transfer and credits your balance.
            </p>
            <Button
              fullWidth
              loading={scan.isPending}
              onClick={() => scan.mutate()}
              className="mt-1"
            >
              <RefreshCw className="size-4" />
              I&apos;ve sent it — check for deposit
            </Button>
          </CardBody>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Recent deposits</h2>
        {deposits.data && deposits.data.deposits.length > 0 ? (
          <Card>
            <ul className="divide-y divide-border">
              {deposits.data.deposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
                      <ArrowDownLeft className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Deposit</p>
                      <p className="text-[13px] text-muted">{relativeTime(d.createdAt)}</p>
                    </div>
                  </div>
                  <p className="tabular text-sm font-semibold text-foreground">
                    +{formatAmount(d.amount)} {MUSD_SYMBOL}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <CardBody className="py-8">
              <EmptyState icon={ArrowDownLeft} title="No deposits yet" description="Deposits you make will show up here." />
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
