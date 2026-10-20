"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { BalanceCards } from "@/components/pocket/home/BalanceCards";
import { FaucetSheet } from "@/components/pocket/home/FaucetSheet";
import { RewardsSheet } from "@/components/pocket/home/RewardsSheet";
import {
  BellIcon,
  BorrowIcon,
  FaucetIcon,
  MenuIcon,
  ReceiveIcon,
  RequestIcon,
  RewardsIcon,
  SendIcon,
} from "@/components/pocket/icons";
import { TransactionRow } from "@/components/pocket/ledger/TransactionRow";
import { EmptyState } from "@/components/pocket/ui/States";
import { SCREEN } from "@/components/pocket/theme";
import type { Recipient, Transaction } from "@/features/payments/payment.types";
import type { FaucetController } from "@/hooks/use-faucet";

/**
 * Home.
 *
 * The reference's layout, top to bottom: a bar of two corners, the greeting,
 * the two stacked balance cards, a row of three verbs, and the last few
 * payments under a "View All" that leads to the rest.
 *
 * The order is the point. Money first, the things you do to it second, the
 * record of having done it last — which is also the order the questions get
 * asked in.
 *
 * The tiles are Send, Request, Receive and Borrow: the four things this build
 * can actually do. Borrow was removed once, because the screen behind it priced
 * a trove out of invented collateral and an invented rate; it is back, and what
 * is behind it now reads the real position off Mezo and shows nothing it could
 * not read.
 */
export function HomeScreen({
  user,
  balance,
  borrowedUnits = null,
  btc,
  transactions,
  recipients,
  highlightId,
  unreadCount,
  faucet,
  onSend,
  onRequest,
  onReceive,
  onBorrow,
  onRepay,
  onOpenNotifications,
  onOpenAccount,
  onOpenLedger,
  onOpenTransaction,
}: {
  user: { name: string; avatarUrl?: string };
  /**
   * The wallet's mUSD, in minor units — the one balance. `null` until the chain
   * read resolves: the card withholds the figure rather than printing a
   * `$0.00` that is a claim and not a reading.
   */
  balance: bigint | null;
  /**
   * What the wallet owes on its Trove, in minor units, when one is open.
   *
   * The borrowed MUSD is *in* `balance` above — Mezo mints it straight to the
   * wallet — so this is not a second balance to add. It is the part of the one
   * balance that is on loan, and the card uses it to decompose the figure and
   * to say what a repayment would settle.
   *
   * `null` is the ordinary case: no Trove is open. The card still divides the
   * figure, with the borrowed half at zero, so the decomposition is on the card
   * from the first load; `0n` is normalised to `null` by the card.
   */
  borrowedUnits?: bigint | null;
  /**
   * The wallet's native BTC, when a chain source has answered — absent during
   * the moment before the read resolves. `valueUnits` carries what it is worth
   * once a price has been read, and is `null` until then. Passed straight
   * through; the card decides how to say what is not known about it.
   */
  btc?: { amount: string; valueUnits: bigint | null } | null;
  transactions: Transaction[];
  recipients: Recipient[];
  /** The payment the user just made, drawn lit until they look away. */
  highlightId: string | null;
  unreadCount: number;
  /**
   * The one-time testnet faucet, and what sits in its place once it is spent.
   *
   * The header owns the icon rather than the screen behind it because a claim
   * is a thing you do *to* the wallet, and the wallet's controls are the two
   * corners of the bar. The controller carries its own state machine so this
   * component never decides whether a claim has happened — it reads it.
   */
  faucet: FaucetController;
  onSend: () => void;
  onRequest: () => void;
  onReceive: () => void;
  onBorrow: () => void;
  /**
   * Opens the repay screen. Always given: the button is always drawn, disabled
   * when there is nothing to repay.
   */
  onRepay?: () => void;
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

  const [faucetOpen, setFaucetOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const recent = transactions.slice(0, 4);

  const tiles = [
    { label: "Send", Icon: SendIcon, onPress: onSend },
    { label: "Request", Icon: RequestIcon, onPress: onRequest },
    { label: "Receive", Icon: ReceiveIcon, onPress: onReceive },
    { label: "Borrow", Icon: BorrowIcon, onPress: onBorrow },
  ];

  return (
    <div className={SCREEN}>
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
          {/*
            The faucet, and after it the rewards it turns into. One slot, two
            occupants: while a claim is owed it is a tap to claim, and once the
            claim is spent the same tap becomes the rewards promise. `loading`
            keeps the slot drawn — empty, disabled — so the bar does not shift
            a beat after the first paint.
          */}
          {faucet.state === "hidden" ? null : faucet.state === "claimed" ? (
            <button
              type="button"
              onClick={() => setRewardsOpen(true)}
              aria-label="Rewards"
              title="Rewards"
              className="pk-ib"
            >
              <RewardsIcon size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFaucetOpen(true)}
              disabled={faucet.state === "loading"}
              aria-label="Testnet faucet"
              title="Testnet faucet"
              className="pk-ib disabled:opacity-40"
            >
              <FaucetIcon size={20} />
            </button>
          )}

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
            data-tour="account"
          >
            <Avatar name={user.name} src={user.avatarUrl} size={44} />
          </button>
        </div>
      </header>

      <h1 className="pk-h1">Hello {firstName}!</h1>
      <p className="pk-m" style={{ marginBottom: 16 }}>
        Let&apos;s save your money.
      </p>

      {/*
        `data-tour` hooks are the walkthrough's targets. They sit on the real
        elements rather than on wrappers invented for the tour, so a step points
        at what the user will actually press — and if a screen is rearranged the
        overlay finds the attribute wherever it moved, or skips the step.
      */}
      <div data-tour="balance">
        <BalanceCards
          walletUnits={balance}
          borrowedUnits={borrowedUnits}
          btc={btc}
          onRepay={onRepay}
        />
      </div>

      {/*
        `.pk-tiles` is a fixed four-column grid, which four tiles now fill
        exactly. The count is still set inline rather than left to the class: it
        costs nothing, and it means the grid follows the list if a tile is ever
        added or removed, instead of silently wrapping.
      */}
      <div
        className="pk-card pk-tiles"
        data-tour="actions"
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

      <div data-tour="activity">
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

      <FaucetSheet
        open={faucetOpen}
        onClose={() => setFaucetOpen(false)}
        faucet={faucet}
      />
      <RewardsSheet
        open={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
      />
    </div>
  );
}
