"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  CheckIcon,
  LinkIcon,
  QrIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { NumberPad } from "@/components/pocket/transfer/NumberPad";
import { Button } from "@/components/pocket/ui/Button";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { TextArea } from "@/components/pocket/ui/TextField";
import { formatMoney } from "@/lib/formatters";
import { payLink } from "@/features/payments/paylink";
import {
  currentValue,
  expressionText,
  INITIAL_KEYPAD,
  pressBackspace,
  pressDecimal,
  pressDigit,
  pressOperator,
  type KeypadState,
  type Op,
} from "@/features/payments/amount";
import { NOTE_MAX_LENGTH } from "@/features/requests/request.types";

/**
 * Receive a payment (Section 6, screen 29) — charging a customer at the
 * counter.
 *
 * This is the merchant's version of "here is how to pay me", and it differs
 * from the personal receive screen in the one way that matters: it carries an
 * amount. A personal receive hands over an identity and lets the payer decide;
 * a counter charge is a price, agreed before the code is shown, so the payer
 * only has to confirm it.
 *
 * The code is the *same* code. `payLink` already knows how to put an amount in
 * a link and the scan screen already knows how to read one back out, so this
 * screen composes those rather than inventing a second link format that would
 * have to be taught to the scanner separately.
 *
 * Nothing here is chargeable, and the badge says so — the honest state before
 * Mezo wiring, because a merchant who believes the code works will discover it
 * does not while a customer is standing in front of them.
 */
export function MerchantReceiveScreen({ onBack }: { onBack: () => void }) {
  const { session, push } = usePocket();

  const handle = session?.user.handle || "@yourbusiness";
  const name =
    session?.user.businessName || session?.user.name || "Your business";

  const [keypad, setKeypad] = useState<KeypadState>(INITIAL_KEYPAD);
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const amountUnits = currentValue(keypad);
  const amountReady = amountUnits !== null && amountUnits > 0n;

  const link = amountReady ? payLink(handle, amountUnits ?? undefined) : null;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Charge"
        subtitle="Take a payment at the counter"
        onBack={onBack}
      />

      <div className="space-y-3">
        {/*
          The price is a row rather than a field: it opens the keypad, which is
          the only way to put a number in it. A text input here would invite a
          typed "12,50" that the keypad's own arithmetic never produces.
        */}
        <button
          type="button"
          onClick={() => setEntering(true)}
          className="pk-card flex w-full items-center gap-3 text-left outline-none"
        >
          <span className="pk-ico">$</span>
          <span className="pk-f">
            <span className="pk-m block font-semibold uppercase">Amount</span>
            <b
              className={
                amountReady
                  ? "mt-0.5 block truncate text-[14px]"
                  : "pk-m mt-0.5 block truncate"
              }
            >
              {amountReady ? formatMoney(amountUnits ?? 0n) : "Set the price"}
            </b>
          </span>
        </button>

        <TextArea
          label="What is it for?"
          hint={`${note.length}/${NOTE_MAX_LENGTH} — shows on the customer's receipt.`}
          maxLength={NOTE_MAX_LENGTH}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Two flat whites"
        />

        {/*
          The code only exists once there is a price. Rendering it earlier would
          show a code that charges nothing, which is worse than showing no code:
          a merchant would scan it and believe it was the charge.
        */}
        {link ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="pk-card flex flex-col items-center"
          >
            <p className="text-[14px] font-bold">{name}</p>
            <p className="mt-0.5 text-[22px] font-extrabold tracking-tight tabular-nums">
              {formatMoney(amountUnits ?? 0n)}
            </p>

            {/* White in both themes, because a camera reads a QR off a light
                field — see the receive screen for the same note. */}
            <div className="mt-5 rounded-2xl bg-white p-3">
              <QrCode
                value={link}
                size={188}
                label={`Charge code for ${formatMoney(amountUnits ?? 0n)}`}
              />
            </div>

            {note.trim() ? (
              <p className="pk-m mt-4 max-w-[28ch] text-center leading-relaxed">
                {note.trim()}
              </p>
            ) : null}
          </motion.div>
        ) : (
          <div className="pk-card flex flex-col items-center px-4 py-8 text-center">
            <span className="pk-ico pk-ico--lg text-[var(--m)]">
              <QrIcon size={22} />
            </span>
            <p className="pk-m mt-2 font-semibold">
              Set a price and the customer&rsquo;s code appears here.
            </p>
          </div>
        )}

        {link ? (
          <Button
            full
            size="lg"
            variant="secondary"
            icon={copied ? <CheckIcon size={16} /> : <LinkIcon size={16} />}
            onClick={() => void copy()}
          >
            {copied ? "Link copied" : "Copy payment link"}
          </Button>
        ) : null}

        {failed ? (
          <p className="px-1 text-center text-[12px] font-semibold text-[color-mix(in_srgb,var(--y)_42%,var(--t))]">
            This browser blocked the clipboard. Copy the code by hand instead.
          </p>
        ) : null}

        {/* The standing code, for the next customer who has no price yet. */}
        <Button
          full
          size="lg"
          variant="ghost"
          onClick={() => push("merchant-qr")}
        >
          Show the counter code instead
        </Button>

        <div className="flex justify-center pt-1">
          <DemoBadge label="Demo — not chargeable" />
        </div>

        <p className="pk-m px-2 text-center leading-relaxed">
          The code is a real QR encoding{" "}
          <span className="text-[var(--t)]">{link ?? payLink(handle)}</span>. No
          wallet resolves that scheme yet, so nobody can actually pay it until
          Mezo is wired.
        </p>
      </div>

      {/* ------------------------------------------------------- keypad */}
      <Sheet open={entering} onClose={() => setEntering(false)} title="How much?">
        <div className="pb-2 text-center">
          <p className="text-[34px] font-extrabold tracking-tight tabular-nums">
            ${expressionText(keypad) || "0"}
          </p>
          <p className="pk-m mt-1.5">
            {amountReady
              ? `The customer will be asked for ${formatMoney(amountUnits ?? 0n)}.`
              : "Enter an amount greater than zero."}
          </p>
        </div>

        <NumberPad
          onDigit={(digit) => setKeypad((state) => pressDigit(state, digit))}
          onDecimal={() => setKeypad(pressDecimal)}
          onOperator={(op: Op) => setKeypad((state) => pressOperator(state, op))}
          onBackspace={() => setKeypad(pressBackspace)}
        />

        {/* Two small controls, deliberately narrower than the pad's own keys:
            they dismiss a sheet, and at full width they read as the decision
            the screen is asking for. */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="min-w-[5.5rem] py-2"
            onClick={() => setKeypad(INITIAL_KEYPAD)}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="min-w-[5.5rem] py-2"
            disabled={!amountReady}
            onClick={() => setEntering(false)}
          >
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
