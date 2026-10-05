"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Receipt,
  Lock,
} from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatAmount } from "@/lib/utils";
import { MUSD_SYMBOL } from "@/lib/mezo/config";

export default function HomePage() {
  const { user } = useSession();
  const available = formatAmount(user?.availableBalance ?? "0");
  const frozen = Number(user?.frozenBalance ?? "0");

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      {/* Dominant balance — no chain, no gas, just a number. */}
      <section className="pt-2 text-center md:pt-6">
        <p className="text-sm font-medium text-muted">Available balance</p>
        <p className="tabular mt-2 text-6xl font-semibold tracking-tight text-foreground">
          {available}
        </p>
        <p className="mt-1 text-sm text-muted">{MUSD_SYMBOL}</p>
        {frozen > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[13px] text-muted">
            <Lock className="size-3.5" />
            <span className="tabular">{formatAmount(frozen)}</span> held in
            flight
          </p>
        )}
      </section>

      {/* Primary actions */}
      <section className="grid grid-cols-3 gap-3">
        <ActionTile href="/pay" icon={ArrowUpRight} label="Send" primary />
        <ActionTile href="/receive" icon={ArrowDownLeft} label="Receive" />
        <ActionTile href="/deposit" icon={Plus} label="Add money" />
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent</h2>
          <Link href="/activity" className="text-[13px] text-primary">
            See all
          </Link>
        </div>
        <Card>
          <CardBody className="py-10">
            <EmptyState
              icon={Receipt}
              title="No activity yet"
              description="Add money to your Pocket, then send MUSD to anyone — Pocket picks the chain."
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  label,
  primary = false,
}: {
  href: string;
  icon: typeof ArrowUpRight;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex flex-col items-center gap-2 rounded-xl bg-primary px-3 py-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-dark"
          : "flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-3 py-4 text-sm font-semibold text-foreground hover:bg-surface-2"
      }
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
