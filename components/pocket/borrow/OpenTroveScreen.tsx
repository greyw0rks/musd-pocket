"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useBalance, useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SCREEN, UP } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { useBorrow } from "@/hooks/use-borrow";
import { useBorrowActions } from "@/hooks/use-borrow-actions";
import {
  CCR,
  MUSD_GAS_COMPENSATION,
  collateralRatio,
  collateralValueUsd,
  liquidationPrice,
  parseDecimalToWei,
  weiToDecimalInput,
} from "@/lib/mezo/borrow-math";
import {
  formatBtc,
  formatLiquidationPrice,
  formatMusd,
  formatRatio,
  formatUsd,
} from "@/lib/mezo/borrow-format";
import { OPEN_GAS_RESERVE } from "@/lib/mezo/borrow-write";

/**
 * Open a position — lock BTC, draw MUSD.
 *
 * Two fields and a preview, and the preview is the screen. A borrow form that
 * takes two numbers and only tells you afterwards what ratio you got is asking
 * the user to sign something they cannot see; everything the action will check
 * is computed here first, from the same live reads, so the figure above the
 * button and the figure the chain enforces are the same figure.
 *
 * Three things this screen never does:
 *
 *  1. **It never fills a number it did not read.** If the price feed is silent
 *     the ratio, the valuation and the liquidation price are withheld and named
 *     as withheld. A dash is honest; a zero is a claim about the user's money.
 *  2. **It never prices the loan itself.** The borrowing fee comes from
 *     `getBorrowingFee` on the chain for the exact draw typed, because the rate
 *     behind it is governance-mutable — a remembered 0.1% is a rate the
 *     protocol may have changed this morning.
 *  3. **It never routes an amount through `features/payments/amount.ts`.** That
 *     module's unit is 2-decimal minor units for MUSD and its parser is right
 *     for the send screen and wrong here by a factor of 10¹⁶ for BTC. Both
 *     fields parse through `parseDecimalToWei`.
 *
 * The signing wallet is the user's own — the position belongs to it, and Pocket
 * never holds the collateral. The footer says so, because a liquidation is the
 * one loss in this app that is entirely the user's.
 */
export function OpenTroveScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  /** Leaving after a successful open, so the dashboard can show the position. */
  onDone: () => void;
}) {
  const actions = useBorrowActions();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { data: native } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });
  const { data: position } = useBorrow();

  const [collateralText, setCollateralText] = useState("");
  const [drawText, setDrawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once a transaction is on-chain — by hash, so a second open is impossible. */
  const [submitted, setSubmitted] = useState<{
    hash: `0x${string}`;
    notice: string | null;
  } | null>(null);

  /*
    The terms and the fee are read live and cached briefly. Both are reads the
    chain has to answer: `minNetDebt` is governance-mutable storage and the fee
    depends on the amount typed, so neither can be a constant in this file.
  */
  const { data: terms } = useQuery({
    queryKey: ["borrow", "terms"],
    queryFn: () => actions.terms(),
    staleTime: 30_000,
  });

  const collateralWei = parseDecimalToWei(collateralText);
  const drawWei = parseDecimalToWei(drawText);

  const { data: fee } = useQuery({
    queryKey: ["borrow", "fee", drawWei?.toString() ?? "0"],
    queryFn: () => actions.fee(drawWei ?? 0n),
    enabled: drawWei !== null && drawWei > 0n,
    staleTime: 30_000,
  });

  /*
    Parsed once, here, so no figure below is built from a half-parsed value or
    from the string form of one.
  */
  const price = position?.price == null ? null : BigInt(position.price);
  const mcr = position?.mcr == null ? null : BigInt(position.mcr);
  const liveTerms = terms && !("error" in terms) ? terms : null;

  /*
    The whole loan, in the three parts the protocol keeps them in: what is drawn,
    the fee the protocol charges, and the 200 MUSD gas reserve that is added to
    every position. The ratio divides by all three — using the drawn amount alone
    would show a healthier position than the chain will.
  */
  const net = drawWei !== null && fee != null ? drawWei + fee : null;
  const composite = net === null ? null : net + MUSD_GAS_COMPENSATION;

  const collateralValue =
    collateralWei !== null && collateralWei > 0n && price !== null
      ? collateralValueUsd(collateralWei, price)
      : null;

  const ratio =
    collateralWei !== null && collateralWei > 0n && composite !== null && price !== null
      ? collateralRatio(collateralWei, composite, price)
      : null;

  const liquidation =
    collateralWei !== null && collateralWei > 0n && composite !== null && mcr !== null
      ? liquidationPrice(collateralWei, composite, mcr)
      : null;

  /*
    What the wallet actually holds, so "Max" cannot propose collateral that
    cannot be paid — the collateral leaves as the call's value, so the gas for
    the call itself has to still be there afterwards.
  */
  const heldWei = native?.value ?? null;
  const maxCollateral =
    heldWei !== null && heldWei > OPEN_GAS_RESERVE
      ? heldWei - OPEN_GAS_RESERVE
      : null;

  /*
    The blocking conditions, in the order the action checks them. Each is the
    same rule `open()` enforces — kept here only so the refusal appears beside
    the field rather than after a press, and never as a substitute: the action
    re-checks everything, and it is the one that decides.
  */
  const blocker = (() => {
    if (collateralWei !== null && collateralWei <= 0n) return "Enter how much BTC to lock.";
    if (drawWei !== null && drawWei <= 0n) return "Enter how much MUSD to borrow.";

    if (net !== null && liveTerms && net < liveTerms.minNetDebt) {
      return `The protocol requires at least ${formatMusd(liveTerms.minNetDebt)} MUSD of net debt. ${formatMusd(drawWei ?? 0n)} plus the fee comes to ${formatMusd(net)}. Borrow more.`;
    }

    if (ratio !== null && ratio < CCR) {
      return `That opens at a ${formatRatio(ratio)} collateral ratio, below the ${formatRatio(CCR)} this app requires. Lock more BTC or borrow less.`;
    }

    if (collateralWei !== null && heldWei !== null && heldWei < collateralWei + OPEN_GAS_RESERVE) {
      return `Your wallet holds ${formatBtc(heldWei)} BTC — not enough to lock ${formatBtc(collateralWei)} and still pay the network fee.`;
    }

    return null;
  })();

  const ready =
    collateralWei !== null &&
    collateralWei > 0n &&
    drawWei !== null &&
    drawWei > 0n &&
    blocker === null &&
    !busy;

  async function submit() {
    if (!ready || collateralWei === null || drawWei === null) return;

    setBusy(true);
    setError(null);

    const result = await actions.open({ collateralWei, drawWei });

    setBusy(false);

    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["borrow"] });
      setSubmitted({ hash: result.hash, notice: null });
      return;
    }

    /*
      A failure carrying a hash is not a failure. The transaction is on-chain and
      only the receipt could not be read, so it is filed as submitted with the
      action's own sentence — which is the one that tells the user not to repeat
      it. Showing it as an error here would invite exactly the second Trove the
      message exists to prevent.
    */
    if (result.hash) {
      await queryClient.invalidateQueries({ queryKey: ["borrow"] });
      setSubmitted({ hash: result.hash, notice: result.error });
      return;
    }

    setError(result.error);
  }

  if (submitted) {
    return (
      <div className={SCREEN}>
        <ScreenHeader title="Position opened" onBack={onDone} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${UP} pk-card`}
          style={{ padding: "18px 20px" }}
        >
          <p className="pk-m">Your Bitcoin is locked and the MUSD is on its way</p>
          <p style={{ marginTop: 6, wordBreak: "break-all" }} className="pk-m">
            {submitted.hash}
          </p>
          <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
            {submitted.notice ??
              "Mezo mines in about seven seconds. The Borrow screen reads the position straight from the chain, so it appears there as soon as the chain has it."}
          </p>
        </motion.div>
        <div style={{ marginTop: 20 }}>
          <Button full onClick={onDone}>
            See your position
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Borrow"
        subtitle="Lock BTC, draw MUSD"
        onBack={onBack}
      />

      <TextField
        label="Bitcoin to lock"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.01"
        value={collateralText}
        onChange={(event) => setCollateralText(event.target.value)}
        hint={
          maxCollateral !== null && maxCollateral > 0n ? (
            <button
              type="button"
              onClick={() => setCollateralText(weiToDecimalInput(maxCollateral))}
              className="font-semibold underline"
            >
              Use max ({formatBtc(maxCollateral)} BTC)
            </button>
          ) : (
            "From the wallet on the Receive screen. It never leaves your custody."
          )
        }
      />

      <TextField
        label="MUSD to borrow"
        inputMode="decimal"
        autoComplete="off"
        placeholder="1000"
        value={drawText}
        onChange={(event) => setDrawText(event.target.value)}
        hint="Drawn into your wallet. It arrives as a debt against the Bitcoin above."
      />

      {/*
        What the position would look like. Every figure is derived from the chain
        reads and the two fields, and any figure that cannot be derived is
        withheld with the reason rather than printed as a zero.
      */}
      <ListGroup label="If you continue">
        <ListRow
          as="div"
          title="Borrowing fee"
          subtitle="Charged once, added to the debt"
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              {drawWei === null || drawWei <= 0n
                ? "—"
                : fee == null
                  ? "Not read"
                  : `${formatMusd(fee)} MUSD`}
            </b>
          }
        />
        <ListRow
          as="div"
          title="Total debt"
          subtitle={`Includes the ${formatMusd(MUSD_GAS_COMPENSATION)} MUSD gas reserve`}
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              {composite === null ? "—" : `${formatMusd(composite)} MUSD`}
            </b>
          }
        />
        <ListRow
          as="div"
          title="Collateral value"
          subtitle={
            price === null
              ? "The price feed did not answer"
              : `At ${formatUsd(price)} per BTC`
          }
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              {collateralValue === null ? "—" : `≈ ${formatUsd(collateralValue)}`}
            </b>
          }
        />
        <ListRow
          as="div"
          title="Collateral ratio"
          subtitle={`The protocol's floor is ${formatRatio(mcr)}`}
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatRatio(ratio)}
            </b>
          }
        />
        <ListRow
          as="div"
          title="Liquidation price"
          subtitle="Below this BTC price the position can be taken"
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatLiquidationPrice(liquidation)}
            </b>
          }
        />
      </ListGroup>

      {/*
        Withheld figures say why. `fetchPrice()` reverts when the oracle is stale,
        and a stale oracle is also a hard stop for `openTrove` — so this is not a
        display gap, it is the operation being unavailable.
      */}
      {price === null ? (
        <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
          The Bitcoin price feed is not answering, so the ratio, the valuation
          and the liquidation price cannot be checked — and the protocol will not
          accept a new position while its own price is stale either. The fee and
          the total debt above are read from the contracts and are current.
        </p>
      ) : null}

      {/*
        Recovery mode is a property of the whole system, and while it holds the
        protocol requires the stricter 150% ratio. This app already opens at
        150% or better, so the position would still be valid — the note is here
        because the *floor the user sees elsewhere* changes, and a number that
        moves without explanation reads as a bug.
      */}
      {liveTerms?.recovery ? (
        <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
          The protocol is in recovery mode. It requires the stricter{" "}
          {formatRatio(CCR)} ratio while it is, which is what this form asks for
          anyway — so a position opened now would still be within the rules.
        </p>
      ) : null}

      {blocker ? (
        <p
          className="pk-m"
          style={{ marginTop: 12, lineHeight: 1.6, color: "var(--r-ink)" }}
        >
          {blocker}
        </p>
      ) : null}

      {error ? (
        <p
          style={{ marginTop: 12, lineHeight: 1.6, color: "var(--r-ink)" }}
          className="pk-m"
        >
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <Button
          full
          variant="purple"
          disabled={!ready}
          loading={busy}
          onClick={() => void submit()}
        >
          {busy ? "Opening" : "Open position"}
        </Button>
        <p
          className="pk-m"
          style={{ marginTop: 10, textAlign: "center", lineHeight: 1.6 }}
        >
          Signed by your own wallet. Pocket never holds your Bitcoin and cannot
          borrow on your behalf — if the price falls far enough, the liquidation
          is yours.
        </p>
      </div>
    </div>
  );
}
