"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ReceiptIcon } from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Chip, ChipRow } from "@/components/pocket/ui/Chip";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { PageHeading } from "@/components/pocket/ui/ScreenHeader";
import { EmptyState } from "@/components/pocket/ui/States";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { formatMoney } from "@/lib/formatters";
import { relativeTime } from "@/lib/utils";

type Range = "all" | "today" | "week";

const RANGES = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
] as const satisfies readonly { id: Range; label: string }[];

function sinceFor(range: Range): number {
  if (range === "all") return 0;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  return now.getTime() - 7 * 24 * 60 * 60 * 1000;
}

/**
 * Merchant payment history — the Payments tab.
 *
 * Money in only. A merchant's history is not a personal statement with the
 * signs flipped — the useful columns are what came in, from whom, and when it
 * is worth paying out. Showing sent transfers here would make the list look
 * complete when it is not.
 *
 * Each row opens screen 33 rather than dead-ending. A list a merchant can read
 * but not open is a report; what a merchant actually does with a payment is
 * check it — who paid, when, under which reference — so the row is the way in.
 *
 * The empty state stays the honest default, because the demo seeds no in-person
 * payments: the seeded receipts are personal transfers, and a merchant who has
 * taken nothing yet should see exactly that.
 */
export function MerchantPaymentsScreen() {
  const { transactions, session, push } = usePocket();
  const mounted = useMounted();
  const [range, setRange] = useState<Range>("all");

  const { rows, total } = useMemo(() => {
    const since = sinceFor(range);
    const received = transactions
      .filter((tx) => tx.direction === "received")
      .filter((tx) => tx.createdAt.getTime() >= since);

    return {
      rows: received,
      total: received.reduce((sum, tx) => sum + tx.amountUnits, 0n),
    };
  }, [transactions, range]);

  return (
    <div className={SCREEN}>
      <PageHeading title="Payments" />

      <p className="pk-m -mt-2 mb-3">
        {session?.user.businessName || session?.user.name || "Your business"}
      </p>

      <ChipRow>
        {RANGES.map(({ id, label }) => (
          <Chip key={id} selected={range === id} onClick={() => setRange(id)}>
            {label}
          </Chip>
        ))}
      </ChipRow>

      <div className="pk-card mt-5">
        <p className="pk-m font-semibold uppercase">
          {range === "today"
            ? "Taken today"
            : range === "week"
              ? "Taken this week"
              : "Taken overall"}
        </p>
        <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums">
          {formatMoney(total)}
        </p>
      </div>

      <div className="mt-5">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon size={22} />}
            title="No payments in this period"
            description="Counter payments and paid requests will land here as they happen."
          />
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ListGroup
              label={`${rows.length} payment${rows.length === 1 ? "" : "s"}`}
            >
              {rows.map((tx) => (
                <ListRow
                  key={tx.id}
                  title={tx.recipientName}
                  subtitle={
                    mounted
                      ? `${tx.recipientHandle} · ${relativeTime(tx.createdAt)}`
                      : tx.recipientHandle
                  }
                  onPress={() =>
                    push("merchant-payment-detail", { transactionId: tx.id })
                  }
                  trailing={
                    <span className="pk-pos text-[13px] font-semibold tabular-nums">
                      +{formatMoney(tx.amountUnits)}
                    </span>
                  }
                />
              ))}
            </ListGroup>
          </motion.div>
        )}
      </div>
    </div>
  );
}
