"use client";

import { useMemo, useState } from "react";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import { TransactionRow } from "@/components/pocket/ledger/TransactionRow";
import { SpendingChart } from "@/components/pocket/spending/SpendingChart";
import { SCREEN } from "@/components/pocket/theme";
import { ChipRow } from "@/components/pocket/ui/Chip";
import { EmptyState } from "@/components/pocket/ui/States";
import { formatMoney } from "@/lib/formatters";
import { monthLabel, summarizeMonth } from "@/features/payments/spending";
import type { Recipient, Transaction } from "@/features/payments/payment.types";

type Filter = "all" | "sent" | "received";

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
];

/**
 * Spending.
 *
 * The reference's month card — a total, a comparison pill, and a chart of the
 * month day by day — over a filterable list of what made up the total.
 *
 * Everything on this screen is *derived from the ledger the user can already
 * see*. That is what makes it honest: there is no spending figure here that
 * cannot be reconstructed from the rows underneath it, and an empty ledger
 * produces zeros rather than a plausible-looking month.
 *
 * Two things the reference has that this does not, both deliberate. The
 * reference filters by category — Repayment, Sending, Payments — because it
 * invented transactions to fit those boxes. This ledger records who a payment
 * went to and nothing about what it was for, so the filter is by direction,
 * which is the one division the data actually supports. And the comparison
 * pill disappears rather than showing `0%` when there is no previous month to
 * compare against.
 */
export function SpendingScreen({
  transactions,
  recipients,
  highlightId,
  onOpenTransaction,
}: {
  transactions: Transaction[];
  recipients: Recipient[];
  highlightId: string | null;
  onOpenTransaction: (transactionId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  /*
    Captured once. Recomputed on every render, a screen left open across
    midnight would silently move to the new month and change its own numbers
    underneath the reader.
  */
  const reference = useMemo(() => new Date(), []);
  const summary = useMemo(
    () => summarizeMonth(transactions, reference),
    [transactions, reference],
  );

  const portraitById = useMemo(
    () => new Map(recipients.map((person) => [person.id, person.avatarUrl])),
    [recipients],
  );

  const rows = useMemo(
    () =>
      filter === "all"
        ? transactions
        : transactions.filter((tx) => tx.direction === filter),
    [transactions, filter],
  );

  const change = summary.changePct;
  const down = change !== null && change < 0;

  return (
    <div className={`${SCREEN} pt-[max(env(safe-area-inset-top),16px)]`}>
      <h1 className="pk-h1" style={{ marginTop: 0 }}>
        Spending
      </h1>
      <p className="pk-m">{monthLabel(reference)}</p>

      <div className="pk-card" style={{ margin: "14px 0" }}>
        <div className="pk-row pk-sp">
          <div>
            <span className="pk-m">This month</span>
            <div className="pk-big" style={{ fontSize: 28 }}>
              {formatMoney(summary.spentUnits)}
            </div>
            <DemoBadge />
          </div>

          {/*
            No pill when there is no prior month. A change from nothing has no
            percentage, and the alternative — inventing one — is the kind of
            number that looks authoritative precisely because it is wrong.
          */}
          {change !== null ? (
            <span
              className="pk-pill"
              style={{
                background: `color-mix(in srgb, var(${down ? "--g" : "--r"}) 20%, transparent)`,
                color: `var(${down ? "--g" : "--r"})`,
              }}
            >
              {down ? "↓" : "↑"} {Math.abs(change)}%
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <SpendingChart
            dailyUnits={summary.dailyUnits}
            peakDay={summary.peakDay}
            label={`Daily spending for ${monthLabel(reference)}; the tallest bar is day ${
              summary.peakDay + 1
            }. Total ${formatMoney(summary.spentUnits)}.`}
          />
        </div>
      </div>

      <ChipRow>
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`pk-chip ${filter === option.id ? "pk-chip--on" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </ChipRow>

      {rows.length > 0 ? (
        <div className="pk-card" style={{ padding: "4px 16px" }}>
          {rows.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              portrait={portraitById.get(tx.recipientId)}
              highlighted={tx.id === highlightId}
              onPress={() => onOpenTransaction(tx.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            transactions.length === 0
              ? "Nothing spent yet"
              : `Nothing ${filter} this month`
          }
          description={
            transactions.length === 0
              ? "Payments you make will be broken down here by day."
              : "Try a different filter, or the full list under Transactions."
          }
        />
      )}
    </div>
  );
}
