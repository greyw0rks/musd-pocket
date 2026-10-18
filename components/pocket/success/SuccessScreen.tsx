"use client";

import { motion } from "motion/react";
import { CheckIcon } from "@/components/pocket/icons";
import { SCREEN_PLAIN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { formatMoney } from "@/lib/formatters";
import type { Transaction } from "@/features/payments/payment.types";

/**
 * Receipt.
 *
 * One screen, one disc, one number. The idea — which is the reference's — is
 * that a completed payment should feel like a door closing, so there is
 * nothing here to read except what was sent and to whom.
 *
 * The full-bleed green fill the previous build used is gone. It was the one
 * surface in the app that could not invert, so it was the one screen that
 * would have looked like a different product in light mode. The disc carries
 * the same signal in a fraction of the area, and it does it in both themes.
 *
 * What is left under the amount is the record's own reference, small and
 * unremarked. The reference number is not decoration: it is how this receipt
 * is tied back to the row in Activity, and how a payment is looked up when
 * something about it needs checking.
 */
export function SuccessScreen({
  transaction,
  onDone,
  onViewDetails,
}: {
  transaction: Transaction;
  onDone: () => void;
  onViewDetails?: () => void;
}) {
  return (
    <div className={SCREEN_PLAIN}>
      <div className="pk-center flex-1">
        {/*
          The disc lands first and lands *hard* — it overshoots, which is what
          `pk-pop` does — and everything after it fades up in its wake. That
          ordering is the whole animation: the tick is the news, the rest is
          the detail.
        */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 15, delay: 0.1 }}
          className="pk-circ bg-[var(--g)]"
        >
          <CheckIcon size={48} />
        </motion.div>

        <motion.h1
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="pk-h1"
        >
          Sent!
        </motion.h1>

        <motion.span
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="pk-m tabular-nums"
        >
          <b className="text-[var(--t)]">{formatMoney(transaction.amountUnits)}</b>{" "}
          is on its way to {transaction.recipientName}
        </motion.span>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex w-full max-w-full flex-col items-center gap-1"
        >
          {/*
            `overflowWrap: anywhere` and a width cap, because this reference is
            not always a short id. When the record call did not land, the
            transfer's own hash takes its place — sixty-six characters with no
            break opportunity in them — and at that length the string is wider
            than the screen and runs over the edge of the receipt. The rule only
            breaks a word that cannot fit, so "ref" and a short id are untouched.
          */}
          <span
            className="pk-m max-w-full px-6 text-center font-mono text-[10px]"
            style={{ overflowWrap: "anywhere" }}
          >
            ref {transaction.id}
          </span>
        </motion.div>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 grid w-full gap-2.5"
        >
          <Button full onClick={onDone}>
            Done
          </Button>
          {onViewDetails ? (
            <Button full variant="secondary" onClick={onViewDetails}>
              View details
            </Button>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
