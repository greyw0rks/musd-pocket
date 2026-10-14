"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  BanIcon,
  CheckIcon,
  ClockIcon,
  ReceiptIcon,
  SendIcon,
  UndoIcon,
  XIcon,
} from "@/components/pocket/icons";
import { SCREEN, stagger } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { useMounted } from "@/components/pocket/ui/useMounted";
import {
  REQUEST_STATUS_LABEL,
  type PaymentRequest,
  type SettleRequestResult,
} from "@/features/requests/request.types";
import { formatMoney } from "@/lib/formatters";
import { cn, relativeTime, untilTime } from "@/lib/utils";

/**
 * One request, in full.
 *
 * The whole point of this screen is that it can tell the difference between a
 * question and an answer. An open incoming request offers Pay and Decline and
 * shows no receipt, because nothing has happened yet. A paid one offers the
 * receipt its payment actually wrote — the same ledger entry the ledger screen
 * would show, reached by id rather than recounted here.
 *
 * Paying is the only action on this screen that can move money, and it goes
 * through the store, which routes it through the payment service. Declining and
 * cancelling are local status changes with nothing behind them.
 */
export function RequestDetailScreen({
  request,
  counterparty,
  onBack,
  onPay,
  onPaid,
  onDecline,
  onCancel,
  onOpenTransaction,
}: {
  request: PaymentRequest;
  /** The person's current portrait, looked up because a request stores no face. */
  counterparty: { avatarUrl?: string } | null;
  onBack: () => void;
  onPay: () => Promise<SettleRequestResult>;
  onPaid: (transactionId: string) => void;
  onDecline: () => Promise<void>;
  onCancel: () => Promise<void>;
  onOpenTransaction: (transactionId: string) => void;
}) {
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incoming = request.direction === "incoming";
  const open = request.status === "open";

  const stamp = mounted ? relativeTime(request.createdAt) : "";
  const expires = mounted ? untilTime(request.expiresAt) : "";

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await onPay();

    setBusy(false);

    // The screen that knows whether the money moved is this one, so it is the
    // one that hands the receipt id up — a parent guessing at success from a
    // status change would be a second opinion about the same fact.
    if (result.ok) onPaid(result.transaction.id);
    else setError(result.error);
  }

  async function decline() {
    setSettling(true);
    await onDecline();
    setSettling(false);
  }

  async function cancel() {
    setSettling(true);
    await onCancel();
    setSettling(false);
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title={incoming ? "Request to you" : "Your request"}
        subtitle={REQUEST_STATUS_LABEL[request.status]}
        onBack={onBack}
      />

      <div className="flex flex-1 flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center pt-2 text-center"
        >
          <Avatar
            name={request.counterpartyName}
            src={counterparty?.avatarUrl}
            size={64}
            className="ring-2 ring-[var(--s2)]"
          />

          <p className="mt-3 text-[14px] font-bold">{request.counterpartyName}</p>
          <p className="pk-m">{request.counterpartyHandle}</p>

          <p className="mt-5 text-[38px] leading-none font-bold tracking-tight tabular-nums">
            {formatMoney(request.amountUnits)}
          </p>

          <p className="pk-m mt-2">
            {incoming
              ? `${request.counterpartyName} is asking you for this`
              : `You asked ${request.counterpartyName} for this`}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <StatusPill status={request.status} />
            <DemoBadge label="Demo — no funds move" />
          </div>
        </motion.div>

        <div className="pk-card mt-7 !px-0 !py-0">
          {request.note ? (
            <Detail label="For" value={request.note} />
          ) : (
            <Detail label="For" value="No reason given" muted />
          )}
          <Detail
            label="Asked"
            value={
              stamp ? `${stamp} · ${REQUEST_STATUS_LABEL[request.status]}` : "—"
            }
          />
          <Detail
            label={open ? "Expires" : "Closed"}
            value={
              open
                ? expires || "—"
                : request.settledAt && mounted
                  ? relativeTime(request.settledAt)
                  : "—"
            }
          />
        </div>

        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 px-1 text-center text-[12px] font-semibold text-[var(--r)]"
          >
            {error}
          </motion.p>
        ) : null}

        {/* A paid request is a payment, and the receipt already exists. Sending
            the user to it beats describing it again here in slightly different
            words — the two could only ever disagree. */}
        {request.transactionId ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => onOpenTransaction(request.transactionId as string)}
            className="pk-card mt-4 flex w-full items-center gap-3 text-left outline-none"
          >
            <span className="pk-ico">
              <ReceiptIcon size={16} />
            </span>
            <span className="pk-f">
              <b className="truncate text-[14px]">View the payment receipt</b>
              <span className="pk-m mt-0.5 block">Ledger</span>
            </span>
          </motion.button>
        ) : null}

        <p className="pk-m mt-5 px-2 text-center leading-relaxed">
          {open
            ? "This is a question, not a payment. Nothing has moved, and nothing moves until it is answered."
            : "Requests stay on this list after they close, so the answer is still readable later."}
        </p>

        {/*
          The actions are the last thing in the column rather than a bar pinned
          over it, so a long note pushes them down the page instead of hiding
          the note behind them.
        */}
        <div className="mt-auto space-y-2 pt-5">
          {open && incoming ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={stagger(0)}
              className="space-y-2"
            >
              <Button
                full
                size="lg"
                icon={<SendIcon size={16} />}
                loading={busy}
                disabled={settling}
                onClick={() => void pay()}
              >
                {busy ? "Paying" : `Pay ${formatMoney(request.amountUnits)}`}
              </Button>
              <Button
                full
                size="lg"
                variant="ghost"
                icon={<XIcon size={16} />}
                disabled={busy || settling}
                onClick={() => void decline()}
              >
                {settling ? "Declining" : "Decline"}
              </Button>
            </motion.div>
          ) : null}

          {open && !incoming ? (
            <Button
              full
              size="lg"
              variant="ghost"
              icon={<UndoIcon size={16} />}
              disabled={settling}
              onClick={() => void cancel()}
            >
              {settling ? "Withdrawing" : "Withdraw request"}
            </Button>
          ) : null}

          {!open ? (
            <Button full size="lg" variant="secondary" onClick={onBack}>
              Done
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-3.5 last:border-b-0">
      <span className="pk-m shrink-0 font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-right text-[13px] font-medium",
          muted ? "pk-m italic" : "text-[var(--t)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The status, coloured by what it means for the user rather than by its name.
 *
 * Open is the only one that wants something from them, so it is the only one
 * that gets an attention colour. Paid is the only green, because it is the only
 * status where money actually moved. Everything that closed without money
 * moving — declined, cancelled, expired — stays muted: none of them is a
 * failure the user has to do anything about.
 */
const STATUS_TONE: Record<PaymentRequest["status"], string> = {
  open: "pk-pill pk-pill--warn",
  paid: "pk-pill pk-pill--ok",
  declined: "pk-pill",
  cancelled: "pk-pill",
  expired: "pk-pill",
};

function StatusPill({ status }: { status: PaymentRequest["status"] }) {
  const icon =
    status === "open" ? (
      <ClockIcon size={12} />
    ) : status === "paid" ? (
      <CheckIcon size={12} />
    ) : status === "cancelled" ? (
      <UndoIcon size={12} />
    ) : (
      <BanIcon size={12} />
    );

  return (
    <span className={STATUS_TONE[status]}>
      {icon}
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}
