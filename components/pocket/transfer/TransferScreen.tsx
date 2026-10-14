"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import { SCREEN_PLAIN } from "@/components/pocket/theme";
import { NumberPad } from "@/components/pocket/transfer/NumberPad";
import { SwipeConfirm } from "@/components/pocket/transfer/SwipeConfirm";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import {
  currentValue,
  expressionText,
  isConfirmable,
  isOp,
  type KeypadState,
  type Op,
} from "@/features/payments/amount";
import type { Recipient } from "@/features/payments/payment.types";
import { formatMoney } from "@/lib/formatters";
import { shortenAddress } from "@/lib/utils";

export type TransferPhase = "idle" | "sending";

/**
 * Transfer.
 *
 * The send screen from the previous build, on the new surface. Every part of
 * the mechanism is untouched — the expression keypad, the arithmetic preview,
 * the keyboard bindings, the swipe-to-confirm — because the ask was to swap
 * this screen *in*, not to re-specify it. What changed is the vocabulary: the
 * bar, the amount, the error ink and the keypad now come from the stylesheet,
 * so the screen turns over with the theme like everything else.
 *
 * The big line is the *expression*, not the result, with the total previewed
 * underneath — so typing "10 + 5" never silently rewrites what you entered.
 * What actually gets sent is always `currentValue`, never the string on screen.
 *
 * The recipient lives in the header rather than in a chip below it. The
 * chevron that used to sit there changed the recipient by going back, which is
 * what the back control already does, so the chip was a second button for one
 * action.
 */
export function TransferScreen({
  recipient,
  keypad,
  balance,
  phase,
  error,
  resetSignal,
  onDigit,
  onDecimal,
  onOperator,
  onBackspace,
  onConfirm,
  onChangeRecipient,
  onRequest,
  onBack,
}: {
  recipient: Recipient;
  keypad: KeypadState;
  balance: bigint;
  phase: TransferPhase;
  error: string | null;
  resetSignal: number;
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onOperator: (op: Op) => void;
  onBackspace: () => void;
  onConfirm: () => void;
  onChangeRecipient: () => void;
  /** Switch this recipient over to a request instead of a payment. */
  onRequest: () => void;
  onBack: () => void;
}) {
  const expression = expressionText(keypad);
  const total = currentValue(keypad);
  const hasOperator = keypad.pending.some((token) => token.kind === "op");

  const overBalance = total !== null && total > balance;
  const hasAmount = total !== null && total > 0n;
  const canConfirm = isConfirmable(keypad) && !overBalance && phase === "idle";

  // Physical keyboards exist, and a phone keypad on screen is not an excuse to
  // ignore one. Enter is skipped while a control has focus so it activates the
  // control instead of sending.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typingInControl =
        target?.tagName === "BUTTON" || target?.tagName === "INPUT";

      if (event.key === "Escape") {
        onBack();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        onBackspace();
        return;
      }
      if (event.key === "Enter") {
        if (!typingInControl && canConfirm) onConfirm();
        return;
      }
      if (event.key >= "0" && event.key <= "9") {
        onDigit(event.key);
        return;
      }
      if (event.key === "." || event.key === ",") {
        onDecimal();
        return;
      }
      if (isOp(event.key)) {
        onOperator(event.key);
        return;
      }
      if (event.key === "*" || event.key === "x") onOperator("×");
      if (event.key === "/") onOperator("÷");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canConfirm,
    onBack,
    onBackspace,
    onConfirm,
    onDecimal,
    onDigit,
    onOperator,
  ]);

  return (
    <div className={SCREEN_PLAIN}>
      <ScreenHeader
        title={`Send to ${recipient.name.split(" ")[0]}`}
        subtitle={
          shortenAddress(recipient.address, 4) || recipient.handle || undefined
        }
        onBack={onChangeRecipient}
        action={
          /*
            The old screen put a Send/Request tab pair across the top. A tab
            pair needs two labels and a bar to sit in; this is one action, so
            it is one labelled control.

            Labelled rather than an arrow, which is the change worth recording.
            An arrow here was a second left-pointing glyph sitting in the same
            bar as the back chevron, and the two read as two ways back. The
            word says what it does and cannot be confused with anything else on
            the screen.
          */
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 460, damping: 26 }}
            onClick={onRequest}
            aria-label={`Ask ${recipient.name} for money instead`}
            title={`Ask ${recipient.name} for money instead`}
            className="pk-chip outline-none"
          >
            Ask
          </motion.button>
        }
      />

      <div className="flex flex-1 flex-col">
        <motion.div
          key={expression || "empty"}
          initial={{ scale: 0.94 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center gap-2"
        >
          <span className="pk-amt">${expression || "0"}</span>

          {/* The person, kept small and next to the figure it will leave from. */}
          <Avatar
            name={recipient.name}
            src={recipient.avatarUrl}
            size={26}
            className="shrink-0 translate-y-[5px]"
          />
        </motion.div>

        {hasOperator && total !== null && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="pk-m text-center tabular-nums"
          >
            = {formatMoney(total)}
          </motion.p>
        )}

        <p className="pk-m text-center tabular-nums">
          Available {formatMoney(balance)}
        </p>

        {overBalance && (
          <p className="mt-3 text-center text-[12px] font-semibold text-[var(--r)]">
            That is more than your available balance.
          </p>
        )}

        {error && (
          <p className="mx-auto mt-3 max-w-[16rem] text-center text-[12px] font-semibold text-[var(--r)]">
            {error}
          </p>
        )}

        {/*
          The confirm control and the keypad are one block pinned to the bottom
          of the column, so the keypad does not move when the swipe bar appears
          — the bar grows into space that was already reserved for it.
        */}
        <div className="mt-auto pt-4">
          <motion.div
            initial={false}
            animate={{
              opacity: hasAmount ? 1 : 0,
              height: hasAmount ? "auto" : 0,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            aria-hidden={!hasAmount}
            className="overflow-hidden"
          >
            <SwipeConfirm
              onConfirm={onConfirm}
              confirmAriaLabel={`Send ${formatMoney(total ?? 0n)} to ${recipient.name}`}
              disabled={!canConfirm}
              busy={phase === "sending"}
              resetSignal={resetSignal}
            />
            <div className="mt-2 mb-3 flex justify-center">
              <DemoBadge label="Demo — no real funds" />
            </div>
          </motion.div>

          <NumberPad
            onDigit={onDigit}
            onDecimal={onDecimal}
            onOperator={onOperator}
            onBackspace={onBackspace}
          />
        </div>
      </div>
    </div>
  );
}
