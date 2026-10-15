"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * The two balance cards.
 *
 * The reference stacks a yellow card behind a purple one so the bottom card
 * shows a strip of itself above the top card, and a tap swaps them. The strip
 * is the whole affordance — without it nobody discovers there is a second
 * card, and with it the swap needs no explaining.
 *
 * The two cards answer two different questions about the same money, and the
 * reference is careful to keep them apart:
 *
 *  - The **total** is a *composition*. It splits what the wallet holds by
 *    asset — BTC and musd — with the native amount on each row and what that
 *    amount is worth underneath it.
 *  - The **available** is a *sum*. It reads `$3,000 + $200`, two figures
 *    joined by a plus, because what you can spend right now is the two halves
 *    of the same pair added together rather than one number with a story.
 *
 * The two pairs, though, are not the same pair — and this is the distinction
 * the whole card is built to hold:
 *
 *  - The total's `musd` is MUSD the user **sent or received** and is holding.
 *    It is written lowercase and unqualified for exactly that reason: it is
 *    the token, not the obligation. MUSD borrowed against collateral is the
 *    same token and a completely different promise, so it does not get folded
 *    into this row. When a trove exists it gets its own line rather than
 *    quietly changing what this one means.
 *  - The available's two addends are **borrowed** MUSD and **received** MUSD.
 *    Borrowed MUSD is money you can spend, so it belongs in what is spendable;
 *    received MUSD is money you own; neither is collateral, which is why the
 *    BTC side of the total does not appear here at all.
 *
 * Each card is a positioned `div` with a full-bleed transparent button over
 * it rather than a `button` wrapping the card. The Repay control lives in the
 * corner of the purple card, and a button inside a button is invalid — the
 * overlay keeps the two as siblings, so neither tap has to be filtered out of
 * the other's event.
 *
 * `onRepay` doubles as the borrow switch, because a repayment control only
 * exists where there is something to repay. Without it the purple card stops
 * composing a sum: showing `$0.00 + $165.00` labelled "borrowed + received"
 * tells a real user their wallet has a borrowing side, which is a claim about
 * a feature that is not wired — and the nearest thing to a trove they could go
 * looking for is a demo screen. So one figure, and the word that describes it.
 */

/** One asset's line in the total. */
export interface WalletHolding {
  /** Written exactly as it should read on screen — `BTC`, `musd`. */
  label: string;
  /** The native amount, already formatted — `0.0035`. `null` when nothing backs it yet. */
  amount: string | null;
  /** What that amount is worth, in MUSD minor units. */
  valueUnits: bigint;
}

/** `$3,500.00` → `3,500.00`. The detail rows print the bare figure. */
function bare(units: bigint): string {
  return formatMoney(units).replace("$", "");
}

export function BalanceCards({
  receivedUnits,
  borrowedUnits = 0n,
  repaymentUnits = 0n,
  btc = null,
  onRepay,
}: {
  /** MUSD sent or received and still held, in minor units. */
  receivedUnits: bigint;
  /** MUSD drawn against collateral. Spendable, and owed back. */
  borrowedUnits?: bigint;
  /** MUSD set aside against a trove. Still yours, not spendable. */
  repaymentUnits?: bigint;
  /** BTC the wallet holds, when a chain source exists to read it from. */
  btc?: { amount: string; valueUnits: bigint } | null;
  /** Absent when borrowing is not available — see the note above. */
  onRepay?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const flip = () => setFlipped((v) => !v);

  const borrow = Boolean(onRepay);

  const btcValue = btc?.valueUnits ?? 0n;
  const totalUnits = receivedUnits + btcValue;

  /*
    Two debts and a holding, added rather than subtracted. Borrowed MUSD has
    been drawn and is sitting in the wallet, so it spends like anything else;
    received MUSD is simply yours. What is *not* here is the collateral — BTC
    is what the borrowing is secured against, not something the borrowing
    hands you, so it stops at the total.
  */
  const availableUnits = borrowedUnits + receivedUnits;

  const holdings: readonly WalletHolding[] = [
    {
      label: "BTC",
      amount: btc?.amount ?? null,
      valueUnits: btcValue,
    },
    {
      label: "musd",
      amount: bare(receivedUnits),
      valueUnits: receivedUnits,
    },
  ];

  return (
    <div className={cn("pk-cards", flipped && "pk-cards--flip")}>
      {/* Yellow — the total, and what it is made of. */}
      <div className="pk-cd pk-cd--back">
        <div className="pk-row pk-sp" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Total balance</span>
          <b style={{ fontSize: 15 }}>{formatMoney(totalUnits)}</b>
        </div>

        {/*
          In the DOM while collapsed but invisible, so it is hidden from
          assistive tech at the same time the eye loses it — a collapsed card
          that still reads out its details is worse than one that stays quiet.
        */}
        <div className="pk-det" aria-hidden={!flipped}>
          {holdings.map((holding) => (
            <div key={holding.label}>
              <span>{holding.label}</span>
              <b>{holding.amount ?? "—"}</b>
              <small>
                {holding.amount
                  ? `≈ ${formatMoney(holding.valueUnits)}`
                  : "Not connected"}
              </small>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={flip}
          aria-label="Total balance"
          aria-expanded={flipped}
          className="absolute inset-0 rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--inv)]"
        />
      </div>

      {/* Purple — what can be spent right now, and the two halves it comes from. */}
      <div className="pk-cd pk-cd--front">
        <div className="pk-row pk-sp">
          <span style={{ opacity: 0.8, marginTop: 2 }}>Available balance</span>
          <DemoBadge tone="onPurple" />
        </div>

        {/*
          Two figures, one plus. `white-space: nowrap` because a wrap between
          the addends would read as two balances again rather than as one sum,
          which is the opposite of the point.
        */}
        <div
          className="pk-big"
          style={{ fontSize: 30, whiteSpace: "nowrap", letterSpacing: "-1px" }}
        >
          {borrow ? (
            <>
              {formatMoney(borrowedUnits)}
              <span style={{ opacity: 0.7 }}> + </span>
              {formatMoney(receivedUnits)}
            </>
          ) : (
            formatMoney(receivedUnits)
          )}
        </div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>
          {borrow ? "borrowed + received" : "received"}
        </div>

        {borrow ? (
          <div style={{ position: "absolute", left: 20, bottom: 18 }}>
            <div style={{ opacity: 0.8, fontSize: 12 }}>Repayment balance</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {formatMoney(repaymentUnits)}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={flip}
          aria-label={`Available balance ${formatMoney(availableUnits)}`}
          aria-expanded={!flipped}
          className="absolute inset-0 rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-white"
        />

        {/*
          The inverse corner where the button meets the card. Two discs of the
          page colour carve a fillet out of the corner so the Repay looks
          welded on rather than dropped. Last in the DOM and opaque, so it sits
          above the overlay and takes its own taps.
        */}
        {onRepay ? (
          <span className="pk-notch">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onRepay}
              className="pk-rep"
            >
              Repay
            </motion.button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
