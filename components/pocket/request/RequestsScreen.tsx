"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  PlusIcon,
  ReceiveIcon,
  RequestIcon,
  SendIcon,
} from "@/components/pocket/icons";
import { SCREEN, stagger } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { Chip, ChipRow } from "@/components/pocket/ui/Chip";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { EmptyState, ListSkeleton } from "@/components/pocket/ui/States";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { REQUEST_STATUS_LABEL } from "@/features/requests/request.types";
import type { PaymentRequest } from "@/features/requests/request.types";
import { formatMoney } from "@/lib/formatters";
import { cn, relativeTime } from "@/lib/utils";

/**
 * Requests.
 *
 * A list the build plan does not name, added because two other screens need a
 * destination: a request notice has to land somewhere, and a request you sent
 * is otherwise invisible until the day it is paid. An outgoing request with no
 * list to live on is a request the user cannot withdraw.
 *
 * Open requests come first and settled ones after, within each the newest
 * first. The alternative — strict reverse-chronological — buries the one
 * request that wants an answer under a week of answered ones, which is the
 * wrong order for a screen whose job is answering.
 */
export function RequestsScreen({
  requests,
  loading,
  onBack,
  onOpen,
  onNew,
}: {
  requests: PaymentRequest[];
  loading: boolean;
  onBack: () => void;
  onOpen: (requestId: string) => void;
  onNew: () => void;
}) {
  const mounted = useMounted();
  const [filter, setFilter] = useState<"all" | "answer" | "waiting" | "closed">(
    "all",
  );

  const counts = useMemo(
    () => ({
      answer: requests.filter(
        (request) => request.direction === "incoming" && request.status === "open",
      ).length,
      waiting: requests.filter(
        (request) => request.direction === "outgoing" && request.status === "open",
      ).length,
      closed: requests.filter((request) => request.status !== "open").length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    const matched = requests.filter((request) => {
      if (filter === "answer")
        return request.direction === "incoming" && request.status === "open";
      if (filter === "waiting")
        return request.direction === "outgoing" && request.status === "open";
      if (filter === "closed") return request.status !== "open";
      return true;
    });

    // Open before settled, newest first inside each group. `sort` is stable, so
    // the service's newest-first order survives inside the two buckets.
    return [...matched].sort(
      (a, b) => Number(b.status === "open") - Number(a.status === "open"),
    );
  }, [requests, filter]);

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Requests"
        subtitle={
          counts.answer > 0
            ? `${counts.answer} waiting on you`
            : "Nothing needs an answer"
        }
        onBack={onBack}
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<PlusIcon size={14} />}
            onClick={onNew}
            aria-label="New request"
          >
            New
          </Button>
        }
      />

      <ChipRow>
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
          All {requests.length}
        </Chip>
        <Chip selected={filter === "answer"} onClick={() => setFilter("answer")}>
          To answer {counts.answer}
        </Chip>
        <Chip selected={filter === "waiting"} onClick={() => setFilter("waiting")}>
          Waiting {counts.waiting}
        </Chip>
        <Chip selected={filter === "closed"} onClick={() => setFilter("closed")}>
          Closed {counts.closed}
        </Chip>
      </ChipRow>

      <div className="mt-3">
        {!mounted || loading ? (
          <ListSkeleton rows={5} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ReceiveIcon size={22} />}
            title={
              requests.length === 0 ? "No requests yet" : "Nothing in this view"
            }
            description={
              requests.length === 0
                ? "Ask someone for money and it will appear here, along with the requests other people send you."
                : "The other filters may have something. Nothing is hidden — this view is just empty."
            }
            action={
              requests.length === 0 ? (
                <Button
                  variant="secondary"
                  icon={<PlusIcon size={14} />}
                  onClick={onNew}
                >
                  New request
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="pk-card !px-3 !py-1">
            {visible.map((request, index) => (
              <RequestRow
                key={request.id}
                request={request}
                index={index}
                onPress={() => onOpen(request.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="pk-m mt-5 px-1 leading-relaxed">
        Requesting money moves nothing. Each request here is a question this app
        asked, and it expires on its own a week later whether or not it is
        answered.
      </p>
    </div>
  );
}

/**
 * The colour a status wears.
 *
 * Open is a caution rather than a success: it is the one state that is still
 * somebody's job. Paid is the only green, because it is the only status that
 * means money moved. Everything that ended without money moving — declined,
 * cancelled, expired — is muted, since none of them is a failure the user
 * needs to act on.
 */
const STATUS_PILL: Record<PaymentRequest["status"], string> = {
  open: "pk-pill pk-pill--warn",
  paid: "pk-pill pk-pill--ok",
  declined: "pk-pill",
  cancelled: "pk-pill",
  expired: "pk-pill",
};

function RequestRow({
  request,
  index,
  onPress,
}: {
  request: PaymentRequest;
  index: number;
  onPress: () => void;
}) {
  const mounted = useMounted();
  const incoming = request.direction === "incoming";
  const settled = request.status !== "open";

  // Only an open incoming request wants something from the user, so only that
  // one is drawn as needing attention.
  const wantsAnswer = incoming && settled === false;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={stagger(index)}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={onPress}
        className={cn(
          "pk-li w-full text-left outline-none",
          wantsAnswer && "bg-[color-mix(in_srgb,var(--y)_14%,transparent)]",
        )}
      >
        <Avatar name={request.counterpartyName} size={36} />

        <span className="pk-f">
          <span className="flex items-center gap-1.5">
            <b className="truncate text-[14px]">
              {incoming
                ? `${request.counterpartyName} asked you`
                : `You asked ${request.counterpartyName}`}
            </b>
            {incoming ? (
              <RequestIcon
                size={13}
                aria-hidden="true"
                className="shrink-0 text-[var(--y)]"
              />
            ) : (
              <SendIcon
                size={13}
                aria-hidden="true"
                className="shrink-0 text-[var(--m)]"
              />
            )}
          </span>

          <span className="pk-m mt-0.5 block truncate">
            {request.note ?? request.counterpartyHandle}
            {mounted ? ` · ${relativeTime(request.createdAt)}` : ""}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-[14px] font-semibold tabular-nums",
              settled && "text-[var(--m)]",
            )}
          >
            {formatMoney(request.amountUnits)}
          </span>
          <span className={cn(STATUS_PILL[request.status], "mt-1")}>
            {REQUEST_STATUS_LABEL[request.status]}
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
}
