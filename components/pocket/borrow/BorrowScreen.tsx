"use client";

import { motion } from "motion/react";
import { BorrowIcon, InfoIcon } from "@/components/pocket/icons";
import { useBorrow, type BorrowView } from "@/hooks/use-borrow";
import { SCREEN, UP } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/pocket/ui/States";
import { MUSD_GAS_COMPENSATION } from "@/lib/mezo/borrow-write";
import {
  formatBtc,
  formatLiquidationPrice,
  formatMusd,
  formatRatio,
  formatThreshold,
  formatUsd,
} from "@/lib/mezo/borrow-format";
import { collateralValueUsd, type TroveHealth } from "@/lib/mezo/borrow-math";

/**
 * Borrow — the position dashboard.
 *
 * Mezo Borrow is MUSD drawn against Bitcoin, and this screen answers one
 * question: *how much room is left before this position is taken?* Every figure
 * on it serves that, which is why the ratio and the liquidation price lead and
 * the raw collateral sits under them.
 *
 * This screen only reads. Opening and repaying are separate screens, because
 * they are separate decisions — and because a dashboard that doubles as a form
 * is a dashboard nobody can safely glance at. It reaches them through two
 * optional callbacks and draws each control only when given one, so a caller
 * that has not wired a write screen gets a dashboard without that button rather
 * than a dead one.
 *
 * Two rules this screen keeps, both inherited from the rest of the app:
 *
 *  1. **No figure is invented.** Everything here comes from `/api/borrow`, which
 *     reads the chain. Where a reading is missing the screen names which one and
 *     withholds the number; it never prints a zero in its place.
 *  2. **Every figure is 18-decimal wei**, so it is rendered by
 *     `lib/mezo/borrow-format.ts` and never by `formatUnits` from
 *     `features/payments/amount.ts`. Those two modules speak different unit
 *     systems and crossing them is a factor of 10¹⁶.
 *
 * The risk verdict is deliberately withheld when the price oracle does not
 * answer. `troveHealth(null, mcr)` returns "healthy" — right as arithmetic
 * (there is no ratio to judge) and wrong as advice, since it would call a
 * position fine at the exact moment the app lost the ability to check.
 */

/** How each verdict reads: its label, its colour, and what to do about it. */
const HEALTH: Record<
  TroveHealth,
  { label: string; pill: string; note: string }
> = {
  healthy: {
    label: "Healthy",
    pill: "pk-pill pk-pill--ok",
    note: "Comfortably above the floor. The Bitcoin price would have to fall a long way before this position is at risk.",
  },
  caution: {
    label: "Caution",
    pill: "pk-pill pk-pill--warn",
    note: "The buffer above the floor is getting thin. Adding collateral or repaying part of the debt widens it.",
  },
  risky: {
    label: "At risk",
    pill: "pk-pill pk-pill--warn",
    note: "A modest drop in the Bitcoin price could put this position below the floor, where it can be liquidated.",
  },
  liquidation: {
    label: "Liquidatable",
    pill: "pk-pill pk-pill--rd",
    note: "At or below the protocol's minimum ratio. This position can be liquidated at any time.",
  },
};

export function BorrowScreen({
  onBack,
  onOpenTrove,
  onRepay,
}: {
  onBack: () => void;
  /**
   * Both optional, and each is rendered only when given. A button that leads
   * nowhere is worse than no button, so a caller that has not wired a write
   * screen gets a dashboard without that control rather than a dead one.
   */
  onOpenTrove?: () => void;
  onRepay?: () => void;
}) {
  const { data, isPending, isError, error, refetch, isFetching } = useBorrow();

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Borrow" onBack={onBack} />

      {isPending ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState
          title="Could not read your position"
          description={
            error instanceof Error
              ? error.message
              : "The Mezo network did not answer."
          }
          onRetry={() => refetch()}
        />
      ) : data.hasTrove ? (
        <Position view={data} refreshing={isFetching} onRepay={onRepay} />
      ) : (
        <NoPosition
          /*
            A Trove closed by liquidation is a different fact from one that
            never existed, and the difference is the whole reason somebody opens
            this screen after a bad week. It is named rather than flattened into
            "you have no position".
          */
          closedBy={data.statusLabel}
          onOpenTrove={onOpenTrove}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* An open position                                                            */
/* -------------------------------------------------------------------------- */

function Position({
  view,
  refreshing,
  onRepay,
}: {
  view: BorrowView;
  refreshing: boolean;
  onRepay?: () => void;
}) {
  /*
    Parsed once, here, so no figure below can be built from a half-parsed value
    or, by accident, from the string form.
  */
  const collateral = BigInt(view.collateral);
  const debt = BigInt(view.debt);
  const mcr = BigInt(view.mcr);
  const price = view.price === null ? null : BigInt(view.price);
  const ratio =
    view.collateralRatio === null ? null : BigInt(view.collateralRatio);
  const ltv = view.ltv === null ? null : BigInt(view.ltv);
  const liquidation =
    view.liquidationPrice === null ? null : BigInt(view.liquidationPrice);

  /*
    What the collateral is worth, in the same 18-decimal dollars the debt is in,
    so the two are comparable by eye. Null when the oracle is silent rather than
    a value computed against a price nobody has.
  */
  const collateralValue =
    price === null ? null : collateralValueUsd(collateral, price);

  const health = HEALTH[view.health];
  const priceKnown = price !== null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${UP} pk-card`}
        style={{ padding: "18px 20px" }}
      >
        <div className="pk-row pk-sp">
          <span className="pk-m font-semibold uppercase">Your position</span>
          {/*
            The pill is the verdict, and the only coloured thing on the screen.
            When the oracle is silent it goes neutral and says what is actually
            wrong, rather than borrowing the green that means "checked, and
            fine".
          */}
          {priceKnown ? (
            <span className={health.pill}>{health.label}</span>
          ) : (
            <span className="pk-pill">Not checked</span>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="pk-m">Collateral</p>
          <p className="pk-big" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBtc(collateral)} BTC
          </p>
          <p className="pk-m">
            {collateralValue === null
              ? "Not valued — the price feed did not answer."
              : `≈ ${formatUsd(collateralValue)} MUSD`}
          </p>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
          }}
        >
          <p className="pk-m">Borrowed</p>
          <p className="pk-big" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatMusd(debt)} MUSD
          </p>
          <p className="pk-m">
            Includes the {formatMusd(MUSD_GAS_COMPENSATION)} MUSD gas reserve.
          </p>
        </div>
      </motion.div>

      {/*
        The pill says which state; this says what it means. When the price is
        missing it says that instead — a verdict the app could not compute must
        not be implied by silence.
      */}
      <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
        {priceKnown
          ? health.note
          : "The Bitcoin price feed did not answer, so the collateral ratio, the loan-to-value and the risk verdict are withheld. The collateral and debt above are read straight from the chain and are current."}
      </p>

      <ListGroup label="Risk">
        <ListRow
          as="div"
          title="Collateral ratio"
          subtitle="What the collateral is worth against the debt"
          trailing={<Figure value={formatRatio(ratio)} />}
        />
        <ListRow
          as="div"
          title="Loan to value"
          subtitle="How much of the collateral's value has been borrowed"
          trailing={<Figure value={formatRatio(ltv)} />}
        />
        <ListRow
          as="div"
          title="Liquidation price"
          subtitle={
            liquidation === null
              ? "No collateral, so no threshold"
              : "Below this BTC price the position becomes liquidatable"
          }
          trailing={<Figure value={formatLiquidationPrice(liquidation)} />}
        />
        <ListRow
          as="div"
          title="Bitcoin price"
          subtitle="The Mezo oracle the protocol prices this position with"
          trailing={<Figure value={formatUsd(price)} />}
        />
        <ListRow
          as="div"
          title="Minimum ratio"
          subtitle="The protocol's floor — at or below it, liquidation"
          trailing={<Figure value={formatThreshold(mcr)} />}
        />
      </ListGroup>

      {onRepay ? (
        <div style={{ marginTop: 20 }}>
          <Button full onClick={onRepay}>
            Repay or close
          </Button>
          {/*
            Said plainly, because it is the surprising thing about a Mezo Trove
            and the user meets it the moment they try to draw the debt to zero.
            No figure is quoted for the minimum: `minNetDebt` is governance-
            mutable, so the number belongs to the chain and not to this copy.
          */}
          <p
            className="pk-m"
            style={{ marginTop: 10, textAlign: "center", lineHeight: 1.6 }}
          >
            Repaying can only bring the debt down to the protocol&apos;s
            minimum. Closing is how the position ends and the collateral comes
            back to your wallet.
          </p>
        </div>
      ) : null}

      {/*
        The read refreshes on an interval and the ratio moves with Bitcoin, so
        the tick is drawn. Without it a figure changing under the user's eyes
        reads as the app correcting itself rather than as the market moving.
      */}
      {refreshing ? (
        <p className="pk-m" style={{ marginTop: 14, textAlign: "center" }}>
          Checking again…
        </p>
      ) : null}
    </>
  );
}

/** A right-aligned figure in the rows above. Tabular, so digits do not dance. */
function Figure({ value }: { value: string }) {
  return <b style={{ fontVariantNumeric: "tabular-nums" }}>{value}</b>;
}

/* -------------------------------------------------------------------------- */
/* No position                                                                 */
/* -------------------------------------------------------------------------- */

function NoPosition({
  closedBy,
  onOpenTrove,
}: {
  closedBy: string;
  onOpenTrove?: () => void;
}) {
  /*
    The three endings a Trove can have, each said in the user's terms. Anything
    else — `nonExistent`, or a status this build does not know — falls through
    to the ordinary invitation, which is what a first-time visitor should see.
  */
  const ending =
    closedBy === "closedByLiquidation"
      ? "Your previous position was liquidated: the collateral went to the protocol to clear the debt."
      : closedBy === "closedByRedemption"
        ? "Your previous position was closed by a redemption. Someone repaid MUSD against your collateral, and whatever was left came back to your wallet."
        : closedBy === "closedByOwner"
          ? "You closed your last position, and the collateral came back to your wallet."
          : null;

  return (
    <>
      <EmptyState
        icon={<BorrowIcon size={24} />}
        title={ending ? "No open position" : "Borrow against your Bitcoin"}
        description={
          ending ??
          "Lock BTC as collateral and draw MUSD against it. Your Bitcoin is not sold — it is held by the protocol — and the loan is repaid in MUSD whenever you like."
        }
        action={
          onOpenTrove ? (
            <Button variant="purple" onClick={onOpenTrove}>
              Open a position
            </Button>
          ) : undefined
        }
      />

      {/*
        Who holds the position, said once, before anyone opens one. The rest of
        the app is custodial in feel — Pocket signs nothing and holds nothing —
        and borrowing is where that has consequences, because a liquidation is
        the user's to lose.
      */}
      <div className="pk-card" style={{ padding: "16px 18px" }}>
        <div className="pk-row" style={{ alignItems: "flex-start", gap: 10 }}>
          <span className="pk-ico" aria-hidden="true">
            <InfoIcon size={16} />
          </span>
          <p className="pk-m" style={{ lineHeight: 1.6 }}>
            A position belongs to your wallet, not to Pocket. Pocket never holds
            your collateral and cannot borrow on your behalf — every action is
            signed by you, from the wallet shown on the Receive screen.
          </p>
        </div>
      </div>
    </>
  );
}
