"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  ChevronRightIcon,
  QrIcon,
  ReceiptIcon,
  ReceiveIcon,
  RequestIcon,
  SendIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN, stagger } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { EmptyState } from "@/components/pocket/ui/States";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { formatMoney } from "@/lib/formatters";
import { relativeTime } from "@/lib/utils";
import type { Transaction } from "@/features/payments/payment.types";

/** The local start of today, in milliseconds. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Merchant dashboard (Section 6, screen 27).
 *
 * A merchant's home answers a different question from a personal one. A person
 * wants to know what they have; a business wants to know what came in today,
 * and how to take the next payment. So the figure at the top is takings rather
 * than balance, and the actions are all ways of being paid.
 *
 * The four actions are the four ways a counter actually takes money: a set
 * price, a standing code for whoever walks up, a bill sent to someone, and —
 * because a business also pays people — an ordinary transfer. They lead to
 * screens 29, 30, 31 and the existing send flow; none of them are the personal
 * receive screen any more, because a merchant charging a customer and a person
 * showing a friend their handle turned out to want different screens.
 */
export function MerchantHomeScreen() {
  const { session, transactions, startSend, push } = usePocket();

  const user = session?.user;

  const { todayUnits, weekUnits, todayCount, recent } = useMemo(() => {
    const received = transactions.filter((tx) => tx.direction === "received");
    const since = startOfToday();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const today = received.filter((tx) => tx.createdAt.getTime() >= since);

    return {
      todayUnits: today.reduce((sum, tx) => sum + tx.amountUnits, 0n),
      weekUnits: received
        .filter((tx) => tx.createdAt.getTime() >= weekAgo)
        .reduce((sum, tx) => sum + tx.amountUnits, 0n),
      todayCount: today.length,
      recent: received.slice(0, 4),
    };
  }, [transactions]);

  const handle = user?.handle ?? "@yourbusiness";

  return (
    <div className={SCREEN}>
      {/* The business's own identity, in the slot a pushed screen would put a
          back control. It is a tab root, so there is nothing to go back to —
          the header's job here is to say which account is being looked at. */}
      <header className="pk-bar">
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-2.5">
          <Avatar name={user?.businessName || user?.name || "?"} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">
              {user?.businessName || user?.name || "Your business"}
            </p>
            <p className="pk-m truncate">{handle}</p>
          </div>
        </div>

        <span className="pk-pill shrink-0">Business</span>
      </header>

      <div className="mt-5">
        <p className="pk-m font-semibold uppercase">Takings today</p>

        <div className="mt-1.5 flex items-end gap-2">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="text-[38px] leading-none font-bold tracking-tight tabular-nums"
          >
            {formatMoney(todayUnits)}
          </motion.p>
          <DemoBadge label="Demo data" className="pb-1.5" />
        </div>

        <p className="pk-m mt-1.5">
          {todayCount > 0
            ? `${todayCount} payment${todayCount === 1 ? "" : "s"} in today · ${formatMoney(weekUnits)} this week.`
            : `No payments yet today · ${formatMoney(weekUnits)} this week.`}
        </p>
      </div>

      {/* ------------------------------------------------- the four actions */}
      {/*
        Four ways to be paid, in one grid, at one weight. Only "Charge" takes
        the inverse fill: it is the primary act at a counter, and four equally
        dark buttons would make the screen look like a menu rather than a
        dashboard.
      */}
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <Button
          size="lg"
          className="h-14 justify-start px-4"
          icon={<ReceiveIcon size={16} />}
          onClick={() => push("merchant-receive")}
        >
          Charge
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 justify-start px-4"
          icon={<QrIcon size={16} />}
          onClick={() => push("merchant-qr")}
        >
          Counter code
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 justify-start px-4"
          icon={<RequestIcon size={16} />}
          onClick={() => push("merchant-request")}
        >
          Request
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 justify-start px-4"
          icon={<SendIcon size={16} />}
          onClick={startSend}
        >
          Send MUSD
        </Button>
      </div>

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-[14px] font-bold">Recent payments</h2>
        <button
          type="button"
          onClick={() => push("merchant-payments")}
          className="pk-m flex items-center gap-0.5 font-semibold outline-none"
        >
          See all
          <ChevronRightIcon size={13} />
        </button>
      </div>

      <div className="mt-3">
        {recent.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon size={22} />}
            title="Nothing has come in yet"
            description="Payments you take will appear here, newest first."
          />
        ) : (
          <ul className="pk-card !px-3 !py-1">
            {recent.map((tx, index) => (
              <PaymentRow
                key={tx.id}
                transaction={tx}
                index={index}
                onOpen={() =>
                  push("merchant-payment-detail", { transactionId: tx.id })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaymentRow({
  transaction,
  index,
  onOpen,
}: {
  transaction: Transaction;
  index: number;
  onOpen: () => void;
}) {
  const mounted = useMounted();

  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={stagger(index)}
    >
      <button
        type="button"
        onClick={onOpen}
        className="pk-li w-full text-left outline-none"
      >
        <span className="pk-f">
          <b className="truncate text-[14px]">{transaction.recipientName}</b>
          <span className="pk-m mt-0.5 block truncate">
            {transaction.recipientHandle}
            {mounted ? ` · ${relativeTime(transaction.createdAt)}` : ""}
          </span>
        </span>

        {/* Takings are always money in, so this is one of the few places the
            positive ink is unconditionally right. */}
        <span className="pk-pos shrink-0 text-[14px] font-semibold tabular-nums">
          +{formatMoney(transaction.amountUnits)}
        </span>
      </button>
    </motion.li>
  );
}
