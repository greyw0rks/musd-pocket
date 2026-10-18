"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";
import { SCREEN, UP } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { ErrorState, ListSkeleton } from "@/components/pocket/ui/States";
import { useBtcActions, type BtcRecordVerdict } from "@/hooks/use-btc-actions";
import { formatBtc, parseBtc } from "@/lib/mezo/borrow-format";
import { shortenAddress } from "@/lib/mezo/btc-actions";

/**
 * Taking Bitcoin out of the wallet.
 *
 * It is a send, and the screen does not pretend otherwise. On Mezo the gas
 * token *is* Bitcoin, so "withdrawing" it is a plain value transfer to an
 * address — the same act as sending MUSD, one token over. There is no peg-out
 * queue, no bridge, and no Bitcoin address anywhere on this screen, because
 * there is no second rail to name.
 *
 * Two things are said here that a form with these fields would normally leave
 * out, and both of them are about the same hazard — a number the user believes
 * means something it does not:
 *
 *  - **the fee comes out of the same balance as the amount.** A wallet's BTC
 *    pays for its own transfer, so the largest sendable figure is the balance
 *    minus the fee, never the balance. The screen leads with that figure, names
 *    the wallet it belongs to, and states the fee separately.
 *  - **what the history will show.** The transfer is filed in Spending, and the
 *    row says so — because it is the *only* row in that list that is not MUSD,
 *    and a figure that does not say which token it is, is a figure that gets
 *    misread. Filing it was the reason `Withdrawal` gained an `asset` column;
 *    before that, a BTC amount had no honest row to live in.
 *
 * The filing is reported separately from the transfer, because it is a separate
 * fact and can fail on its own. `recorded` and `not filed` are printed as the
 * different things they are: telling a user their transfer is in Spending when
 * the row was never written sends them looking for it and concluding the money
 * never moved.
 *
 * The three outcomes of the write are rendered as three different things, which
 * is the part that costs money if it is got wrong: a hash alongside a failure
 * means the transfer is on-chain and only its receipt went unread. Showing that
 * as an error invites a second send of money that has already moved.
 *
 * Amounts go through `parseBtc`/`formatBtc` (18-decimal wei, eight meaningful
 * places) and never through `features/payments/amount.ts`, whose unit is
 * 2-decimal minor units and would be wrong here by a factor of 10¹⁶.
 */
/**
 * What to say about the history, once the record call has answered.
 *
 * Four cases, and `asking` is real rather than a placeholder: the call is in
 * flight, so at that instant the app genuinely does not know whether the row was
 * written. Saying "not filed" there would be a claim it has not earned, and the
 * user would be told their transfer is missing while it is on its way into the
 * list. The three answers say three different things because they *are* three
 * different situations, and the one that matters most is the last — a transfer
 * that will not appear in Spending, said plainly, before the user goes looking
 * for it.
 */
const WHERE_IT_IS = {
  asking: {
    title: "Filing this in Spending",
    subtitle: "Telling Pocket about a transfer the chain already has.",
  },
  recorded: {
    title: "Filed in Spending",
    subtitle:
      "This appears in Spending as a BTC transfer, under its own amount — it is the one row there that is not MUSD.",
  },
  pending: {
    title: "Filed, not yet confirmed",
    subtitle:
      "The chain had not confirmed it when Pocket asked, so the row is in Spending but marked pending. It is not lost, and there is no need to send it again.",
  },
  unknown: {
    title: "Not filed",
    subtitle:
      "The transfer is on the chain, but Pocket could not record it, so it will not appear in Spending. The hash above is the record of it.",
  },
} as const;

export function WithdrawBtcScreen({ onBack }: { onBack: () => void }) {
  const actions = useBtcActions();
  const queryClient = useQueryClient();

  const {
    data: ceiling,
    isPending,
    isError,
    error: readError,
    refetch,
  } = useQuery({
    queryKey: ["btc", "sendable"],
    queryFn: () => actions.maxSendable(),
    /*
      Short, because the fee it is built from moves with the chain: a ceiling
      held for a minute is a ceiling that may already be too high by the time it
      is spent.
    */
    staleTime: 15_000,
  });

  const [toText, setToText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    hash: `0x${string}`;
    notice: string | null;
  } | null>(null);
  /*
    Null until the record call comes back, which is a state of its own: the
    screen has a receipt and no answer about the history yet, and rendering
    "not filed" during that gap would be a claim the app has not earned.
  */
  const [filed, setFiled] = useState<BtcRecordVerdict | null>(null);

  /*
    A refusal is about the values that were on screen when it was made. Editing
    a field therefore clears it: leaving a sentence about the last attempt under
    a form the user has since changed reads as a statement about the new one.
  */
  function edit(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setError(null);
    };
  }

  /**
   * Every read this transfer invalidates.
   *
   * `["balance"]` is wagmi's own query key for `useBalance`, which is the BTC
   * figure the Home card draws — invalidating the prefix is what makes that card
   * agree with the chain straight after a send rather than at its next poll.
   * The ceiling is this screen's own, and it is wrong the moment money leaves.
   */
  async function refreshReads() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["balance"] }),
      queryClient.invalidateQueries({ queryKey: ["btc", "sendable"] }),
    ]);
  }

  if (isPending) {
    return (
      <div className={SCREEN}>
        <ScreenHeader title="Send BTC" onBack={onBack} />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  /*
    One refusal path, because the action answers with a sentence rather than
    throwing: a wallet that is not ready, a fee that could not be read and a
    balance that could not be read all arrive as `{ error }`, and each of them
    is already written in the app's voice.
  */
  if (isError || !ceiling || "error" in ceiling) {
    return (
      <div className={SCREEN}>
        <ScreenHeader title="Send BTC" onBack={onBack} />
        <ErrorState
          title="Could not read this wallet"
          description={
            ceiling && "error" in ceiling
              ? ceiling.error
              : readError instanceof Error
                ? readError.message
                : "The Mezo network did not answer."
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const max = ceiling;

  if (sent) {
    return (
      <div className={SCREEN}>
        <ScreenHeader
          title={sent.notice ? "Sent, not yet confirmed" : "BTC sent"}
          onBack={onBack}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${UP} pk-card`}
          style={{ padding: "18px 20px" }}
        >
          <p className="pk-m">
            {sent.notice
              ? "The transfer is on the chain. This app could not read the receipt yet, so it cannot say more than that."
              : "The Bitcoin is on its way to the address you typed."}
          </p>
          <p style={{ marginTop: 6, wordBreak: "break-all" }} className="pk-m">
            {sent.hash}
          </p>
          <p className="pk-m" style={{ marginTop: 12, lineHeight: 1.6 }}>
            {sent.notice ?? "Mezo mines in about seven seconds."}
          </p>
        </motion.div>

        <ListGroup label="Where it is now">
          <ListRow
            as="div"
            title={WHERE_IT_IS[filed?.state ?? "asking"].title}
            subtitle={WHERE_IT_IS[filed?.state ?? "asking"].subtitle}
          />
        </ListGroup>

        <div style={{ marginTop: 20 }}>
          <Button full onClick={onBack}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  /*
    Nothing sendable is its own screen rather than a form that would refuse
    every amount typed into it. The figure here is the balance *less* the fee a
    plain transfer costs, so a wallet holding a little BTC still has nothing it
    can move — and saying that plainly is more use than a disabled button.
  */
  if (max.wei === 0n) {
    return (
      <div className={SCREEN}>
        <ScreenHeader
          title="Send BTC"
          subtitle={shortenAddress(max.from)}
          onBack={onBack}
        />
        <ListGroup label="Nothing to send">
          <ListRow
            as="div"
            title="This wallet cannot cover a transfer"
            subtitle="Bitcoin pays for its own transfer, so the fee comes out of the same balance as the amount. This wallet holds less than that fee."
          />
        </ListGroup>
        <p
          className="pk-m"
          style={{ marginTop: 16, textAlign: "center", lineHeight: 1.6 }}
        >
          Send some BTC to {shortenAddress(max.from)} — the address on your
          Receive screen — and it will be spendable from here.
        </p>
        <div style={{ marginTop: 12 }}>
          <Button full variant="secondary" onClick={() => refetch()}>
            Check again
          </Button>
        </div>
      </div>
    );
  }

  const amountWei = parseBtc(amountText);
  const addressOk = isAddress(toText.trim());
  const amountOk = amountWei !== null && amountWei > 0n && amountWei <= max.wei;
  const valid = addressOk && amountOk;

  async function run() {
    if (busy || !valid || amountWei === null) return;
    setBusy(true);
    setError(null);

    /*
      Captured before the send, because the field is still editable and the
      history row has to describe the transfer that was actually made rather
      than whatever is in the box when the call comes back.
    */
    const to = toText.trim();
    const amount = formatBtc(amountWei);

    /**
     * File the row that makes this appear in Spending.
     *
     * It runs after the receipt, never before: the route verifies the transfer
     * against the chain, so there is nothing to file until there is something to
     * verify. Failure is recorded and shown but changes nothing about the
     * transfer — see the caller.
     */
    async function file(hash: `0x${string}`) {
      const verdict = await actions.record({ txHash: hash, toAddress: to, amount });
      setFiled(verdict);
      // The row exists now, so the reads that were refreshed on the transfer
      // alone are stale again — the ledger list picks it up from here.
      if (verdict.state === "recorded") void refreshReads();
    }

    const result = await actions.send({
      to,
      amountWei,
    });

    setBusy(false);

    /*
      The receipt is set before the reads are refreshed, and the refresh is not
      awaited. The transfer has already happened by this point — showing it must
      not depend on a second round of network calls succeeding. That is the same
      reason the recording below is fired rather than awaited: it is bookkeeping
      about a transfer that is already done, and a slow or failed call must not
      hold the confirmation off the screen.
    */
    if (result.ok) {
      setSent({ hash: result.hash, notice: null });
      void refreshReads();
      void file(result.hash);
      return;
    }

    /*
      A hash means it is on-chain and only the receipt could not be read, so it
      is filed as sent with the action's own warning rather than shown as a
      failure. The one thing the user must not do here is send it again.
    */
    if (result.hash) {
      setSent({ hash: result.hash, notice: result.error });
      void refreshReads();
      void file(result.hash);
      return;
    }

    setError(result.error);
    /*
      Refreshed even on a refusal, because the most likely refusal is a stale
      ceiling: the fee moved between this screen reading it and the balance
      check, and the new figure is what the user needs in front of them.
    */
    void refreshReads();
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Send BTC"
        subtitle={shortenAddress(max.from)}
        onBack={onBack}
      />

      <TextField
        label="To address"
        autoComplete="off"
        spellCheck={false}
        placeholder="0x…"
        value={toText}
        onChange={(event) => edit(setToText)(event.target.value)}
        hint="The wallet address that receives it. A Bitcoin address will not work — this is a transfer on Mezo."
        error={
          toText.trim() !== "" && !addressOk
            ? "That is not a wallet address."
            : undefined
        }
      />

      <TextField
        label="Amount in BTC"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amountText}
        onChange={(event) => edit(setAmountText)(event.target.value)}
        hint={
          /*
            The ceiling is offered as a button rather than as prose because it is
            the only figure that is safe to spend, and a user who has to type it
            will drop a digit. `formatBtc` truncates, so what this fills in is
            never more than what was measured.
          */
          <button
            type="button"
            onClick={() => edit(setAmountText)(formatBtc(max.wei))}
            className="font-semibold underline"
          >
            Send the most ({formatBtc(max.wei)} BTC)
          </button>
        }
        error={
          amountText !== "" && amountWei === null
            ? "Enter an amount like 0.001 — up to 8 decimal places."
            : amountWei !== null && amountWei > max.wei
              ? `This wallet can send at most ${formatBtc(max.wei)} BTC.`
              : undefined
        }
      />

      <ListGroup label="What this does">
        <ListRow
          as="div"
          title="Native Bitcoin, on Mezo"
          subtitle="Bitcoin is this network's gas token, so this is an ordinary transfer to the address above. Nothing is bridged and nothing leaves the chain."
        />
        <ListRow
          as="div"
          title="Network fee"
          subtitle="Paid in BTC, out of the same balance as the amount — which is why the most sendable is not simply the balance."
          trailing={
            <b style={{ fontVariantNumeric: "tabular-nums" }}>
              ≤ {formatBtc(max.feeWei)} BTC
            </b>
          }
        />
        <ListRow
          as="div"
          title="It will appear in Spending"
          subtitle="As a BTC transfer, with its own amount rather than a dollar figure — Spending lists MUSD payments too, and the two are never added together."
        />
      </ListGroup>

      <div style={{ marginTop: 4 }}>
        <Button full disabled={!valid || busy} loading={busy} onClick={() => void run()}>
          {busy ? "Sending" : "Send BTC"}
        </Button>
        <p
          className="pk-m"
          style={{ marginTop: 10, textAlign: "center", lineHeight: 1.6 }}
        >
          Signed by your own wallet. Pocket cannot move this Bitcoin for you.
        </p>
      </div>

      {error ? (
        <p
          style={{ marginTop: 16, lineHeight: 1.6, color: "var(--r-ink)" }}
          className="pk-m"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
