"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  RequestIcon,
  SendIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { formatMoney, PAYMENT_STATUS_LABEL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  Recipient,
  Transaction,
} from "@/features/payments/payment.types";

/**
 * One payment, in full.
 *
 * Section 8 asks for a details screen and section 10 is specific about what it
 * may not claim: this is where "confirmed" would be most tempting to dress up
 * as a settlement, so it is where the screen has to say what it actually is —
 * a record of something that happened inside this app.
 *
 * The "Network" row is the one that carries that. A real receipt shows a chain
 * and a hash; this one shows that there is nothing to show, in the same slot a
 * chain name would occupy, because an absent row reads as an oversight while
 * an explicit one reads as the truth.
 *
 * There is deliberately no explorer link. There is nothing to link to, and a
 * disabled "View on explorer" would be the exact control this build keeps
 * removing.
 */
export function TransactionDetailScreen({
  transaction,
  recipient,
  onBack,
  onSendAgain,
}: {
  transaction: Transaction;
  /** The counterparty, when they are still in the contact list. */
  recipient: Recipient | null;
  onBack: () => void;
  onSendAgain: (recipientId: string) => void;
}) {
  const mounted = useMounted();
  const [copied, setCopied] = useState(false);

  const received = transaction.direction === "received";
  const isDemo = transaction.kind === "demo";
  const counterpartyLabel = received ? "From" : "To";

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused. The reference is on screen and
      // selectable, so there is nothing to recover from — silently doing
      // nothing is better than an error about a convenience.
    }
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Payment details" onBack={onBack} />

      <div className="flex flex-col items-center pt-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className={cn(
            "pk-ico pk-ico--lg",
            // `.pk-ico` is unlayered and sets its own background, so the
            // incoming tint needs `!` to land at all — without it the disc
            // silently stays grey and the colour never says "money in".
            received
              ? "!bg-[color-mix(in_srgb,var(--g)_14%,transparent)] text-[var(--g-ink)]"
              : "bg-[var(--s2)] text-[var(--m)]",
          )}
        >
          {received ? <RequestIcon size={22} /> : <SendIcon size={22} />}
        </motion.div>

        <p className="pk-m mt-3 font-medium">
          {received ? "You received" : "You sent"}
        </p>

        <h2 className="mt-0.5 text-[30px] font-extrabold tracking-tight tabular-nums">
          {formatMoney(transaction.amountUnits)}
        </h2>

        <div className="mt-3">
          {/*
            A real row states its *status*, not its chain.

            This used to read a flat "On-chain" for anything that was not a
            fixture, which is a claim the data does not support: a row can be
            `pending` (submitted, not settled) or `failed`. `PaymentStatusPill`
            already makes that distinction for the row below, so the header uses
            the same one rather than contradicting it — and it keeps the
            existing decision that confirmed is neutral, since green in this app
            means money arrived, which a settled outgoing payment is not.
          */}
          {isDemo ? (
            <DemoBadge label="Simulated — no funds moved" />
          ) : (
            <PaymentStatusPill status={transaction.status} />
          )}
        </div>
      </div>

      <div className="mt-7 space-y-5">
        <ListGroup label="Payment">
          <ListRow
            as="div"
            leading={
              <Avatar
                name={transaction.recipientName}
                src={recipient?.avatarUrl}
                size={32}
              />
            }
            title={`${counterpartyLabel} ${transaction.recipientName}`}
            subtitle={
              recipient?.verified
                ? "Identity verified in this demo."
                : "Not a saved contact any more."
            }
            trailing={
              <span className="pk-m font-medium">
                {transaction.recipientHandle}
              </span>
            }
          />

          <ListRow
            as="div"
            title="Status"
            subtitle={
              transaction.status === "confirmed"
                ? "Recorded. This is a record in the app, not a settlement."
                : undefined
            }
            trailing={<PaymentStatusPill status={transaction.status} />}
          />

          <ListRow
            as="div"
            title="Date"
            trailing={
              <span className="pk-m font-medium tabular-nums">
                {mounted
                  ? transaction.createdAt.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            }
          />

          <ListRow
            as="div"
            title="Time"
            trailing={
              <span className="pk-m font-medium tabular-nums">
                {mounted
                  ? transaction.createdAt.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            }
          />
        </ListGroup>

        <ListGroup label="Reference">
          <ListRow
            as="div"
            title="Reference"
            subtitle="An identifier for this record inside the app."
            trailing={
              <span className="pk-m font-mono">{transaction.id}</span>
            }
          />

          <ListRow
            as="div"
            title="Network"
            subtitle="Nothing here has reached a blockchain. The chain and hash will appear here."
            trailing={<span className="pk-pill">None</span>}
          />

          {transaction.txHash ? (
            <ListRow
              as="div"
              title="Transaction hash"
              trailing={
                <span className="pk-m font-mono">{transaction.txHash}</span>
              }
            />
          ) : null}
        </ListGroup>

        {/* Two buttons sharing the row. `flex-1` rather than `full`: two
            `w-full` pills in one flex row each ask for the whole width and
            the second one runs off the screen edge. */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="min-w-0 flex-1"
            icon={<CopyIcon size={15} />}
            onClick={() => void copyReference()}
          >
            {copied ? "Copied" : "Copy reference"}
          </Button>

          {recipient ? (
            <Button
              size="lg"
              className="min-w-0 flex-1"
              icon={<RefreshIcon size={15} />}
              onClick={() => onSendAgain(recipient.id)}
            >
              Send again
            </Button>
          ) : null}
        </div>

        <p className="pk-m flex items-start gap-2 leading-relaxed">
          <CheckIcon
            size={13}
            className="mt-0.5 shrink-0 text-[var(--g-ink)]"
          />
          <span>
            When this is wired to a real wallet, the amount, the recipient and
            this screen keep their shape. What changes is that the status would
            come from a chain rather than from the app.
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * The status of a payment, in the colour its meaning earns.
 *
 * Pending is amber because it is unfinished rather than wrong — an outgoing
 * payment that has not landed yet is not a failure, and drawing it in the same
 * red as one would be a lie about what happened. Confirmed is deliberately
 * neutral rather than green: this screen cannot tell a settled incoming payment
 * from a settled outgoing one, and green in this app means money arrived.
 */
function PaymentStatusPill({ status }: { status: Transaction["status"] }) {
  const tone =
    status === "failed"
      // `.pk-pill` sets its own background and colour, so the failed tone has
      // to outrank both. A failed payment that renders as the neutral pill is
      // the one state this screen must never understate.
      ? "pk-pill !bg-[color-mix(in_srgb,var(--r)_15%,transparent)] !text-[var(--r)]"
      : status === "pending"
        ? "pk-pill pk-pill--warn"
        : "pk-pill";

  return <span className={tone}>{PAYMENT_STATUS_LABEL[status]}</span>;
}
