"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { BalanceCards } from "@/components/pocket/home/BalanceCards";
import {
  BellIcon,
  BorrowIcon,
  MenuIcon,
  ReceiveIcon,
  RequestIcon,
  SendIcon,
} from "@/components/pocket/icons";
import { TransactionRow } from "@/components/pocket/ledger/TransactionRow";
import { EmptyState } from "@/components/pocket/ui/States";
import { SCREEN } from "@/components/pocket/theme";
import type { IconProps } from "@/components/pocket/icons";
import type { Recipient, Transaction } from "@/features/payments/payment.types";
import type { ReactElement } from "react";

/**
 * Home.
 *
 * The reference's layout, top to bottom: a bar of two corners, the greeting,
 * the two stacked balance cards, a row of four verbs, and the last few
 * payments under a "View All" that leads to the rest.
 *
 * The order is the point. Money first, the things you do to it second, the
 * record of having done it last — which is also the order the questions get
 * asked in.
 *
 * The four tiles are the same four the reference draws. Three of them lead
 * somewhere; Borrow leads to the screen that explains what borrowing would
 * cost and that it is not switched on yet. That screen is demo-only, so a real
 * wallet does not get the tile at all — see `onBorrow`.
 */
export function HomeScreen({
  user,
  balance,
  transactions,
  recipients,
  highlightId,
  unreadCount,
  onSend,
  onRequest,
  onReceive,
  onBorrow,
  onOpenNotifications,
  onOpenAccount,
  onOpenLedger,
  onOpenTransaction,
}: {
  user: { name: string; avatarUrl?: string };
  balance: bigint;
  transactions: Transaction[];
  recipients: Recipient[];
  /** The payment the user just made, drawn lit until they look away. */
  highlightId: string | null;
  unreadCount: number;
  onSend: () => void;
  onRequest: () => void;
  onReceive: () => void;
  /**
   * Absent when borrowing is not available, which is what draws the Borrow
   * tile and the balance card's Repay notch out of the screen. It is not a
   * disabled control: a tile that leads to a page of invented numbers about a
   * real wallet is worse than one that was never there.
   */
  onBorrow?: () => void;
  onOpenNotifications: () => void;
  onOpenAccount: () => void;
  onOpenLedger: () => void;
  onOpenTransaction: (transactionId: string) => void;
}) {
  /**
   * A transaction names the person it was with, but a portrait belongs to the
   * person, not to the payment. Looking it up here keeps one source of truth
   * for a face, so updating someone's picture updates their whole history
   * rather than only the payments made after the change.
   */
  const portraitById = useMemo(
    () => new Map(recipients.map((person) => [person.id, person.avatarUrl])),
    [recipients],
  );

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const recent = transactions.slice(0, 4);

  /*
    Three or four, depending. Written as a spread into a list rather than as a
    list with a hole in it, so the row has no gap where Borrow would have been.
  */
  const tiles: { label: string; Icon: (props: IconProps) => ReactElement; onPress: () => void }[] = [
    { label: "Send", Icon: SendIcon, onPress: onSend },
    { label: "Request", Icon: RequestIcon, onPress: onRequest },
    { label: "Receive", Icon: ReceiveIcon, onPress: onReceive },
    ...(onBorrow
      ? [{ label: "Borrow", Icon: BorrowIcon, onPress: onBorrow }]
      : []),
  ];

  return (
    <div className={`${SCREEN} pt-[max(env(safe-area-inset-top),16px)]`}>
      <header className="pk-bar">
        <button
          type="button"
          onClick={onOpenLedger}
          aria-label="All transactions"
          title="All transactions"
          className="pk-ib"
        >
          <MenuIcon size={20} />
        </button>

        <div className="pk-row" style={{ gap: 8 }}>
          <span className="relative inline-flex">
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              title="Notifications"
              className="pk-ib"
            >
              <BellIcon size={20} />
            </button>

            {/* The count is the whole reason the bell is worth pressing, so it
                is drawn rather than left to the screen behind it. */}
            {unreadCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--p)] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--bg)]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>

          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Account"
            title="Account"
            className="pk-av"
          >
            <Avatar name={user.name} src={user.avatarUrl} size={44} />
          </button>
        </div>
      </header>

      <h1 className="pk-h1">Hello {firstName}!</h1>
      <p className="pk-m" style={{ marginBottom: 16 }}>
        Let&apos;s save your money.
      </p>

      <BalanceCards receivedUnits={balance} onRepay={onBorrow} />

      {/*
        `.pk-tiles` is a fixed four-column grid, so three tiles would leave a
        ragged empty fourth. The count is set inline, which outranks the
        unlayered class in `pocket.css` without needing a second rule or a `!`.
      */}
      <div
        className="pk-card pk-tiles"
        style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}
      >
        {tiles.map(({ label, Icon, onPress }) => (
          <motion.button
            key={label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onPress}
            className="pk-tile"
          >
            <span>
              <Icon size={22} />
            </span>
            {label}
          </motion.button>
        ))}
      </div>

      <div className="pk-row pk-sp" style={{ margin: "20px 0 4px" }}>
        <h2 className="pk-h2">Manage Expenses</h2>
        <button
          type="button"
          onClick={onOpenLedger}
          className="pk-m font-semibold outline-none"
        >
          View All
        </button>
      </div>

      {recent.length > 0 ? (
        <div className="pk-card" style={{ padding: "4px 16px" }}>
          {recent.map((tx) => (
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
          icon={<SendIcon size={22} />}
          title="No payments yet"
          description="Send your first payment and it will show up here."
        />
      )}
    </div>
  );
}
