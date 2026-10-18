"use client";

import { useState } from "react";
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
 *  - The **available** is a *sum with its parts named*: what can be spent right
 *    now, written as the two things it is made of — MUSD the user holds and
 *    MUSD drawn against their Bitcoin — with those two words under the figures.
 *
 * Both are the wallet. There is no second balance anywhere in this app, so the
 * purple card prints the one number it has and says where it is.
 *
 * ## The borrowed decomposition
 *
 * Drawing MUSD from Mezo Borrow mints it straight into the wallet, so once a
 * Trove is open the one available figure is *two* facts added together: MUSD
 * the user had, and MUSD the user owes. Printing only the sum would be true and
 * misleading — it would read as money that is theirs, and the repayment is a
 * separate line further down the same card.
 *
 * So the sum is written out in the card's large type — `$2,000.00 + $300.00`,
 * with `yours + borrowed` under it naming the two halves in the order they are
 * printed. This is the headline rather than a footnote because the split *is*
 * the model, and it belongs on the card from the first load rather than
 * appearing for the first time on the day someone borrows. The addends are not
 * a second balance and are never presented as one; they are the sum's two
 * parts, and `the total` above still counts the borrowed MUSD exactly once
 * because it is genuinely in the wallet.
 *
 * Both figures are the *composite* Trove debt — drawn plus the protocol's MUSD
 * gas reserve — because that is the number the repayment line owes and the
 * number a close settles. Decomposing against a different debt than the one
 * shown below would mean the two rows disagreed by a fixed 200 MUSD.
 *
 * When the borrowed part exceeds the wallet — the MUSD was drawn and spent —
 * there is no honest positive figure for "yours", and two addends that do not
 * sum to anything the user can see would be worse than none. The card falls
 * back to the wallet's actual MUSD as the headline and says the borrowed part
 * in words instead.
 *
 * The BTC row is real and is priced. It is read from the chain — the wallet's
 * native gas balance on Mezo — and valued at the spot price the app fetches
 * (`/api/price/btc`, via `useBtcPrice`), so it counts toward the total. It is
 * *not* part of the available figure, because it cannot be sent: gas is BTC and
 * mUSD is what `transfer` moves. The total and the available balance therefore
 * answer different questions about the same wallet, which is the point of the
 * two cards.
 *
 * The price can be missing — no source answered, or the read has not landed —
 * and then the row prints its amount and says the valuation is pending. An
 * unpriced holding is held *out* of the total rather than added as a zero:
 * a total that silently omits a holding the user can see named below it is a
 * number they will read as everything they have.
 *
 * Each card is a positioned `div` with a full-bleed transparent button over it
 * rather than a `button` wrapping the card, so the whole surface is tappable
 * while the text inside it stays selectable. The Repay button is the one
 * exception and is drawn *after* that overlay, into `.pk-notch` — the filleted
 * page-coloured corner the stylesheet already carries for it — so it takes the
 * press in its own corner and the rest of the card still flips.
 */

/** One asset's line in the total. */
export interface WalletHolding {
  /** Written exactly as it should read on screen — `BTC`, `musd`. */
  label: string;
  /** The native amount, already formatted — `0.0035`. `null` when nothing backs it yet. */
  amount: string | null;
  /**
   * What that amount is worth, in MUSD minor units — or `null` when the amount
   * is known and its *price* is not.
   *
   * The two absences are different facts and the card cannot treat them alike.
   * `amount: null` means no chain source answered at all. `valueUnits: null`
   * means the amount is real and no price has been read for it: the row can
   * print the amount but must not invent a figure, and must not let it into the
   * total either — a total that silently omits a holding is still a number the
   * user will read as everything they hold.
   */
  valueUnits: bigint | null;
}

/** `$3,500.00` → `3,500.00`. The detail rows print the bare figure. */
function bare(units: bigint): string {
  return formatMoney(units).replace("$", "");
}

export function BalanceCards({
  walletUnits,
  borrowedUnits = null,
  btc = null,
  onRepay,
}: {
  /**
   * MUSD in the user's wallet, in minor units — `null` while the chain read has
   * not answered.
   *
   * `null` is not `0n`, and the difference is the whole reason this is nullable:
   * an unread balance is unknown, and printing `$0.00` over money the user
   * actually holds would be a fabricated number rather than a missing one.
   */
  walletUnits: bigint | null;
  /**
   * What is owed on the user's Trove, in minor units, when one is open.
   *
   * `null` is the normal case and it is not an error: it means no Trove is open
   * — or, briefly, that the position has not been read. The card shows the
   * decomposition either way, with the borrowed half at zero, because the split
   * is the model this app is built on and it belongs on the card from the first
   * load rather than appearing on the day someone borrows.
   *
   * A zero is normalised to `null` below, so "no Trove" and "a Trove with
   * nothing drawn" are one branch instead of two.
   */
  borrowedUnits?: bigint | null;
  /**
   * BTC the wallet holds, when a chain source exists to read it from.
   *
   * `valueUnits` is what that amount is worth in MUSD minor units, or `null`
   * when no price has been read. `null` is not zero and the row says so rather
   * than printing an `≈` figure from a rate this app has not seen — and an
   * unpriced row is left out of the total, because a total that quietly omits a
   * holding is worse than one that names what it could not price.
   */
  btc?: { amount: string; valueUnits: bigint | null } | null;
  /**
   * Opens the repay screen. Always given, because the button is always drawn —
   * disabled when there is nothing to settle, so that borrowing never looks
   * like a door with no handle.
   */
  onRepay?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const flip = () => setFlipped((v) => !v);

  /*
    Everything the wallet holds, once each holding can be valued. An unpriced
    holding contributes nothing and the row below says so in words, so this
    figure is never read as a total of money whose worth is unknown — the card
    would rather under-report and admit it than guess and be believed.

    `null` when the mUSD reading has not answered: a total cannot be composed
    out of a number nobody has read yet, and `$0.00` would be a claim.
  */
  const totalUnits =
    walletUnits === null ? null : walletUnits + (btc?.valueUnits ?? 0n);

  const holdings: readonly WalletHolding[] = [
    {
      label: "BTC",
      amount: btc?.amount ?? null,
      valueUnits: btc?.valueUnits ?? null,
    },
    {
      label: "musd",
      amount: walletUnits === null ? null : bare(walletUnits),
      valueUnits: walletUnits,
    },
  ];

  /*
    The borrowed part, once there is one to show. `0n` folds into `null` here
    rather than at each use below, so the three states the card renders — no
    debt, debt covered by the wallet, debt larger than the wallet — are decided
    once and the JSX only has to spell them.
  */
  const borrowed =
    borrowedUnits !== null && borrowedUnits > 0n ? borrowedUnits : null;

  /*
    The split into two halves, when it can honestly be drawn as two figures.

    `null` only while the wallet balance itself is unread — the borrowed half is
    `0n` until there is a position, and that zero is a statement the card is
    entitled to make: it has been told there is no Trove, rather than left
    wondering whether one exists.
  */
  const halves =
    walletUnits === null
      ? null
      : borrowed !== null && borrowed > walletUnits
        ? null
        : { own: walletUnits - (borrowed ?? 0n), borrowed: borrowed ?? 0n };

  /*
    What the card says in the large type, and the words under it.

    The decomposition is the headline rather than a footnote, because it *is*
    the model: one balance, part of it drawn against Bitcoin. `$6,000.00 + $0.00`
    with `yours` and `borrowed` beneath the two addends says the whole thing in
    one line, and it says it from the first load rather than for the first time
    on the day someone borrows — a borrowed half of zero being the plainest way
    to say there is nothing owed.

    It can only be printed when neither addend is negative. MUSD drawn and then
    spent leaves `yours` in the red, and a headline reading `-$400.00 + $300.00`
    would be two figures that do not add up to anything the user can see. In
    that case the card falls back to the one figure it can stand behind — the
    wallet's actual MUSD — and says the borrowed part in words instead.

    The same fallback covers an unread wallet, where there is no sum to show at
    all and `—` is the honest headline.
  */
  const hero =
    walletUnits === null
      ? "—"
      : halves === null
        ? formatMoney(walletUnits)
        : null;

  const heroNote =
    walletUnits === null
      ? "in your wallet"
      : halves === null
        ? "all of this is borrowed"
        : null;

  /** The headline's type, shared by both figures so they match exactly. */
  const heroFigure = {
    fontSize: 30,
    whiteSpace: "nowrap",
    letterSpacing: "-1px",
  } as const;

  return (
    <div className={cn("pk-cards", flipped && "pk-cards--flip")}>
      {/* Yellow — the total, and what it is made of. */}
      <div className="pk-cd pk-cd--back">
        <div className="pk-row pk-sp" style={{ gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Total balance</span>
          <b style={{ fontSize: 15 }}>
            {totalUnits === null ? "—" : formatMoney(totalUnits)}
          </b>
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
                {holding.amount === null
                  ? "Not connected"
                  : holding.valueUnits === null
                    ? "value pending — not in the total"
                    : `≈ ${formatMoney(holding.valueUnits)}`}
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

      {/* Purple — what can be spent right now, and whose money it is. */}
      <div className="pk-cd pk-cd--front">
        <div className="pk-row pk-sp">
          <span style={{ opacity: 0.8, marginTop: 2 }}>Available balance</span>
        </div>

        {/*
          The headline, and the words under it.

          `$6,000.00 + $0.00` is the reference's own arrangement — the two
          figures joined by a plus in the card's large type, with the names of
          the two halves in small type beneath. The addends are inline text
          rather than two positioned columns: a plus floating between two boxes
          picks up whatever gap the layout gives it and reads as two balances
          side by side, which is the opposite of the point. Set inline, the
          spacing is the type's.

          The labels are not part of the flip button's accessible name — that
          spells the borrowed part out in words instead, which is what a
          listener needs and a glance at two columns does not.
        */}
        {halves === null ? (
          <>
            <div className="pk-big" style={heroFigure}>
              {hero}
            </div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>{heroNote}</div>
          </>
        ) : (
          <>
            <div className="pk-big" style={heroFigure}>
              {formatMoney(halves.own)}
              <span style={{ opacity: 0.7 }}> + </span>
              {formatMoney(halves.borrowed)}
            </div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>yours + borrowed</div>
          </>
        )}

        {/*
          Pinned to the foot of the card, in the same band as the Repay button,
          so the figure you owe and the control that clears it read as one row
          rather than two facts a screen apart. The label sits above the figure
          rather than beside it — the reference's arrangement, and the one that
          survives a large amount, since a row would push the number into the
          notch's corner as the debt grew.

          Always drawn, at `$0.00` when nothing is owed. It is part of the
          card's shape, and a row that comes and goes leaves the card looking
          half-furnished in the state most users are in most of the time.
        */}
        <div style={{ position: "absolute", left: 20, bottom: 18 }}>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Repayment balance</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatMoney(borrowed ?? 0n)}
          </div>
        </div>

        <button
          type="button"
          onClick={flip}
          aria-label={
            walletUnits === null
              ? "Available balance, not read yet"
              : borrowed === null
                ? `Available balance ${formatMoney(walletUnits)}`
                : `Available balance ${formatMoney(walletUnits)}, of which ${formatMoney(borrowed)} is borrowed`
          }
          aria-expanded={!flipped}
          className="absolute inset-0 rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-white"
        />

        {/*
          Drawn last, so it paints over the flip button and takes the press in
          its own corner. `.pk-notch` carves a fillet out of the card with two
          circles of the page colour, which is what makes the button read as
          welded to the card rather than dropped on it.

          Always drawn, and *disabled* when there is nothing to settle, so the
          way to close a loan is visible before there is one to close. A control
          that appears only once someone has borrowed hides the exit from the
          person deciding whether to enter.
        */}
        <div className="pk-notch">
          <button
            type="button"
            onClick={onRepay}
            disabled={borrowed === null || !onRepay}
            title={
              borrowed === null
                ? "Nothing to repay — no MUSD is drawn against your Bitcoin"
                : undefined
            }
            className="pk-rep"
          >
            Repay
          </button>
        </div>
      </div>
    </div>
  );
}
