"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SCREEN, UP } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { ErrorState, ListSkeleton } from "@/components/pocket/ui/States";
import { useBorrow } from "@/hooks/use-borrow";
import { useBorrowActions } from "@/hooks/use-borrow-actions";
import {
  MUSD_GAS_COMPENSATION,
  maxRepayable,
  parseDecimalToWei,
  weiToDecimalInput,
} from "@/lib/mezo/borrow-math";
import { formatBtc, formatMusd } from "@/lib/mezo/borrow-format";

/**
 * Repay, or close — the two ways out of a position, and not the same thing.
 *
 * The distinction is the whole reason this is one screen with two actions
 * rather than one "pay it off" button. A Mezo Trove can never be repaid to
 * zero: the protocol holds every position at a minimum net debt, so a
 * repayment always leaves a position standing, and **closing** is the only way
 * the debt reaches zero and the Bitcoin comes home. A screen that offered only
 * "repay" would leave a user with a dust position they could not get rid of,
 * and no way to guess why.
 *
 * So the form leads with the repayment and states its ceiling as a number, then
 * offers closing as what it is: a different outcome with a different price.
 *
 * Closing costs less than the debt shown on the dashboard. The 200 MUSD gas
 * reserve folded into every Trove is burned from the protocol's own pool, not
 * from the borrower — so the figure quoted here is the debt *less* the reserve.
 * That difference is exactly the kind that gets a user to message support.
 *
 * Both amounts parse through `parseDecimalToWei` (18-decimal wei), never
 * through `features/payments/amount.ts`, whose unit is 2-decimal minor units
 * and whose parser is right for the send screen and wrong here by 10¹⁶.
 */
export function RepayTroveScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  /** Leaving after a successful write, so the dashboard can re-read. */
  onDone: () => void;
}) {
  const actions = useBorrowActions();
  const queryClient = useQueryClient();
  const { data: position, isPending, isError, error: readError, refetch } =
    useBorrow();

  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState<null | "repay" | "close">(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    hash: `0x${string}`;
    what: "repay" | "close";
    notice: string | null;
  } | null>(null);

  /*
    The terms are read here as well as inside the actions, because the form has
    to state the ceiling before the user types and say whether closing is
    possible before they choose it. Both facts are read per visit: `minNetDebt`
    is governance-mutable and recovery mode can begin between two blocks.
  */
  const { data: terms } = useQuery({
    queryKey: ["borrow", "terms"],
    queryFn: () => actions.terms(),
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <div className={SCREEN}>
        <ScreenHeader title="Repay" onBack={onBack} />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (isError || !position) {
    return (
      <div className={SCREEN}>
        <ScreenHeader title="Repay" onBack={onBack} />
        <ErrorState
          title="Could not read your position"
          description={
            readError instanceof Error
              ? readError.message
              : "The Mezo network did not answer."
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={SCREEN}>
        <ScreenHeader
          title={submitted.what === "close" ? "Position closed" : "Repaid"}
          onBack={onDone}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${UP} pk-card`}
          style={{ padding: "18px 20px" }}
        >
          <p className="pk-m">
            {submitted.what === "close"
              ? "The debt is cleared and the Bitcoin is on its way back to your wallet."
              : "The repayment is on its way. The position stays open at a lower debt."}
          </p>
          <p style={{ marginTop: 6, wordBreak: "break-all" }} className="pk-m">
            {submitted.hash}
          </p>
          <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
            {submitted.notice ??
              "Mezo mines in about seven seconds, and the Borrow screen reads the position straight from the chain."}
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

  /*
    Parsed once, so nothing below is built from a half-parsed value or from the
    string form of one.
  */
  const debt = BigInt(position.debt);
  const collateral = BigInt(position.collateral);
  const liveTerms = terms && !("error" in terms) ? terms : null;

  /*
    The ceiling, from the same function the action enforces it with. It is `0n`
    when the position already sits at the protocol's floor, which is the signal
    to stop offering a repayment and offer the close instead — the two are
    mutually exclusive at that point, and offering both would be offering one
    that cannot work.
  */
  const ceiling = liveTerms ? maxRepayable(debt, liveTerms.minNetDebt) : null;
  const canRepay = ceiling !== null && ceiling > 0n;

  const amountWei = parseDecimalToWei(amountText);
  const amountValid =
    amountWei !== null && amountWei > 0n && ceiling !== null && amountWei <= ceiling;

  /** What closing costs: the debt less the reserve the protocol burns for you. */
  const closeCost = debt - MUSD_GAS_COMPENSATION;

  /*
    Closing is impossible while the system is in recovery mode — `closeTrove()`
    calls `_requireNotInRecoveryMode`. That is temporary and entirely outside
    the borrower's control, so it is said before the button rather than arriving
    as a refusal after one.
  */
  const closeBlockedByRecovery = liveTerms?.recovery === true;

  async function run(what: "repay" | "close") {
    if (busy) return;
    setBusy(what);
    setError(null);

    const result =
      what === "close"
        ? await actions.close()
        : await actions.repay(amountWei ?? 0n);

    setBusy(null);

    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["borrow"] });
      // Requested, never awaited — see the note in `OpenTroveScreen.submit`.
      void actions.record(result.hash);
      setSubmitted({ hash: result.hash, what, notice: null });
      return;
    }

    /*
      A hash means the transaction is on-chain and only its receipt could not be
      read, so it is filed as submitted with the action's own warning. Showing
      it as an error would invite a second repayment — and for a close, a second
      close of a position that no longer exists.
    */
    if (result.hash) {
      await queryClient.invalidateQueries({ queryKey: ["borrow"] });
      void actions.record(result.hash);
      setSubmitted({ hash: result.hash, what, notice: result.error });
      return;
    }

    setError(result.error);
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Repay or close"
        subtitle={`${formatMusd(debt)} MUSD owed`}
        onBack={onBack}
      />

      {/*
        The repayment half. The ceiling is stated as a figure because it is the
        thing that surprises people, and because it is read from the chain
        rather than remembered.
      */}
      {canRepay ? (
        <>
          <TextField
            label="MUSD to repay"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            hint={
              ceiling !== null ? (
                <button
                  type="button"
                  onClick={() => setAmountText(weiToDecimalInput(ceiling))}
                  className="font-semibold underline"
                >
                  Repay the most allowed ({formatMusd(ceiling)} MUSD)
                </button>
              ) : (
                "The protocol's floor has not been read yet."
              )
            }
            error={
              amountWei !== null && amountWei > 0n && amountWei > (ceiling ?? 0n)
                ? `The most you can repay is ${formatMusd(ceiling ?? 0n)} MUSD.`
                : undefined
            }
          />

          <div style={{ marginTop: 4 }}>
            <Button
              full
              disabled={!amountValid || busy !== null}
              loading={busy === "repay"}
              onClick={() => void run("repay")}
            >
              {busy === "repay" ? "Repaying" : "Repay"}
            </Button>
            <p
              className="pk-m"
              style={{ marginTop: 10, textAlign: "center", lineHeight: 1.6 }}
            >
              No approval is needed — the contract burns the MUSD straight from
              your wallet. Repaying never closes the position: the protocol
              keeps every Trove at a minimum debt, which is why closing exists.
            </p>
          </div>
        </>
      ) : (
        <ListGroup label="Repayment">
          <ListRow
            as="div"
            title="This position is at the protocol's floor"
            subtitle="A repayment cannot take the debt any lower. Closing is what ends it."
          />
        </ListGroup>
      )}

      {/* ------------------------------------------------------------ close */}

      <div style={{ marginTop: 24 }}>
        <ListGroup label="Close the position">
          <ListRow
            as="div"
            title="Costs"
            subtitle={`Your debt less the ${formatMusd(MUSD_GAS_COMPENSATION)} MUSD gas reserve, which the protocol burns for you`}
            trailing={
              <b style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatMusd(closeCost)} MUSD
              </b>
            }
          />
          <ListRow
            as="div"
            title="You get back"
            subtitle="The whole collateral, to the wallet that opened it"
            trailing={
              <b style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatBtc(collateral)} BTC
              </b>
            }
          />
        </ListGroup>

        {closeBlockedByRecovery ? (
          <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
            The protocol is in recovery mode, and closing is not allowed while it
            is. Repaying part of the debt still works, and closing will work
            again once the system recovers.
          </p>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <Button
            full
            variant="secondary"
            disabled={busy !== null || closeBlockedByRecovery}
            loading={busy === "close"}
            onClick={() => void run("close")}
          >
            {busy === "close" ? "Closing" : "Close position"}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          style={{ marginTop: 16, lineHeight: 1.6, color: "var(--r-ink)" }}
          className="pk-m"
        >
          {error}
        </p>
      ) : null}

      <p
        className="pk-m"
        style={{ marginTop: 20, textAlign: "center", lineHeight: 1.6 }}
      >
        Signed by your own wallet. Pocket cannot repay or close for you.
      </p>
    </div>
  );
}
