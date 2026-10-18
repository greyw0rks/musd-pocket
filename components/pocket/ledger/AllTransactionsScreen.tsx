"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/pocket/icons";
import {
  dayLabel,
  TransactionRow,
} from "@/components/pocket/ledger/TransactionRow";
import { SCREEN, stagger } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { Chip, ChipRow } from "@/components/pocket/ui/Chip";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { SearchField } from "@/components/pocket/ui/SearchField";
import { SpendChart } from "@/components/pocket/ledger/SpendChart";
import { EmptyState, ListSkeleton } from "@/components/pocket/ui/States";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  PaymentDirection,
  Recipient,
  Transaction,
} from "@/features/payments/payment.types";

type Filter = "all" | PaymentDirection;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
];

/**
 * Everything that has moved through this account.
 *
 * The home sheet shows the top of the ledger because that is what the home
 * screen is for; this is the same ledger with the two things a full list owes
 * you that a preview cannot — a way to narrow it, and totals.
 *
 * Totals are computed from the filtered rows rather than from the account, so
 * "Sent $42.50" always describes exactly the rows underneath it. A summary
 * that disagrees with its own list is worse than no summary.
 *
 * Filtering happens in memory, over the rows the caller already has. The list
 * arrives from one service call made at boot, so narrowing it is a redraw
 * rather than a round trip.
 */
export function AllTransactionsScreen({
  transactions,
  recipients,
  onBack,
  onOpenTransaction,
}: {
  transactions: Transaction[];
  /** The contact list, for looking up each counterparty's current portrait. */
  recipients: Recipient[];
  onBack: () => void;
  onOpenTransaction: (transactionId: string) => void;
}) {
  const mounted = useMounted();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const portraitById = useMemo(
    () => new Map(recipients.map((person) => [person.id, person.avatarUrl])),
    [recipients],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter !== "all" && tx.direction !== filter) return false;
      if (!needle) return true;
      return (
        tx.recipientName.toLowerCase().includes(needle) ||
        tx.recipientHandle.toLowerCase().includes(needle) ||
        tx.amountDisplay.includes(needle)
      );
    });
  }, [transactions, filter, query]);

  const totals = useMemo(() => {
    let sent = 0n;
    let received = 0n;
    for (const tx of visible) {
      /*
        MUSD only. `amountUnits` is denominated in the row's own asset, so a BTC
        row folded in here would add wei to hundredths — a total that is not a
        sum of anything. A BTC row is still listed below; it is the list that
        carries it, and the strip names the token it counts.
      */
      if (tx.asset !== "MUSD") continue;
      if (tx.direction === "sent") sent += tx.amountUnits;
      else received += tx.amountUnits;
    }
    return { sent, received };
  }, [visible]);

  /**
   * Days, newest first. Built by walking the already-sorted list rather than
   * by sorting into a map, so the order the service returned is the order the
   * user reads.
   */
  const groups = useMemo(() => {
    const out: { label: string; items: Transaction[] }[] = [];
    for (const tx of visible) {
      const label = dayLabel(tx.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else out.push({ label, items: [tx] });
    }
    return out;
  }, [visible]);

  const narrowed = filter !== "all" || query.trim().length > 0;

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Transactions" onBack={onBack} />

      <div className="space-y-3 pb-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search transactions"
        />

        <ChipRow>
          {FILTERS.map((option) => (
            <Chip
              key={option.id}
              selected={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {/* The totals describe the rows below them, so they are the first thing
          to change when the filter does. Each one is drawn only when there is
          something to count: filtering to Sent and reading "Received $0.00"
          would be a number pretending to be a fact.

          The labels name MUSD because the figures are only MUSD — a BTC
          transfer is in the list underneath and in neither of these. An
          unqualified "Sent $12.00" beside a BTC row the user just made would
          read as that transfer's total. */}
      {mounted && visible.length > 0 ? (
        <div className="flex items-center gap-6 pb-4">
          {totals.sent > 0n ? <Total label="MUSD sent" value={totals.sent} /> : null}
          {totals.received > 0n ? (
            <Total label="MUSD received" value={totals.received} received />
          ) : null}
        </div>
      ) : null}

      {/* The same rows, by month. Fed the filtered list rather than the whole
          ledger for the same reason the totals are: it has to describe exactly
          the rows underneath it. Draws itself only when money actually left in
          the window — an all-empty chart is a screen's worth of height spent
          saying what the list already says. */}
      {mounted && visible.length > 0 ? <SpendChart rows={visible} /> : null}

      {!mounted ? (
        <ListSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={22} />}
          title={narrowed ? "Nothing matches" : "No payments yet"}
          description={
            narrowed
              ? "No transaction fits that search and filter. Clearing one of them will widen it again."
              : "The first thing you send or receive will show up here."
          }
          action={
            narrowed ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group, groupIndex) => (
            <section key={group.label} className="space-y-1">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={stagger(groupIndex, 0.04)}
                className="pk-m px-1 pb-1 font-semibold uppercase"
              >
                {group.label}
              </motion.h2>

              {/* Rows live on the group's own card rather than each carrying a
                  surface, so a day reads as one block and the seams between
                  rows are the card's, not eight separate ones. */}
              <div className="pk-card !px-3 !py-1">
                {group.items.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={stagger(index, 0.04)}
                  >
                    <TransactionRow
                      tx={tx}
                      portrait={portraitById.get(tx.recipientId)}
                      groupedDay
                      onPress={() => onOpenTransaction(tx.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One half of the summary strip.
 *
 * "Received" takes the positive ink because it is the one of the two that added
 * to the balance; "Sent" stays in the default ink, since money leaving is the
 * ordinary case and colouring it red would make a normal outgoing payment look
 * like a problem.
 */
function Total({
  label,
  value,
  received = false,
}: {
  label: string;
  value: bigint;
  received?: boolean;
}) {
  return (
    <div>
      <span className="pk-m block font-medium">{label}</span>
      <span
        className={cn(
          "mt-0.5 block text-[14px] font-bold tabular-nums",
          received && "pk-pos",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}
