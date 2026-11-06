"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sprout, Vault as VaultIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { InfoIcon } from "@/components/pocket/icons";
import { useEarn, type EarnView } from "@/hooks/use-earn";
import { useEarnActions } from "@/hooks/use-earn-actions";
import { useMusdBalance } from "@/hooks/use-musd";
import { SCREEN, UP } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import {
  AmountField,
  FinanceIntro,
  FinanceTabs,
} from "@/components/pocket/ui/Finance";
import { PageHeading, ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { ErrorState, ListSkeleton } from "@/components/pocket/ui/States";
import { formatMusd } from "@/lib/mezo/borrow-format";
import { parseDecimalToWei, weiToDecimalInput } from "@/lib/mezo/borrow-math";

/**
 * Vault — MUSD deposited into Mezo's Savings Vault, earning.
 *
 * Reached from Wealth, with an optional back control for standalone callers.
 *
 * ## The figure that is not computed
 *
 * This screen shows *how much MUSD is saved* and it does not multiply anything
 * to get there. The vault mints one sMUSD per MUSD deposited — a fact decoded
 * from a real deposit's events, not inferred from a ratio, and written up at
 * the top of `lib/mezo/earn.ts` — so a holder's sMUSD balance *is* their
 * principal, and the two figures the API sends are the same number.
 *
 * There is a tempting share price here and it is wrong by a factor of three.
 * `MUSD.balanceOf(vault) / totalSupply()` reads 3.17 on testnet, because the
 * vault forwards its MUSD to a separate strategy contract and the vault's own
 * balance is protocol money rather than depositor money. A screen that used it
 * would show every saver a 217% gain that does not exist. Nothing on this
 * screen is derived that way, and no figure below is computed from a balance
 * the vault holds.
 *
 * ## Interest, kept separate
 *
 * Interest does not move the shares; it accrues beside them and is read from
 * `claimableYield`. That is why the position card and the interest row are two
 * rows and not one total: they are two different things, and only one of them
 * is money the user already has. When the vault will not answer the claimable
 * read, the row says so — a zero printed there would read as "you have earned
 * nothing", which is a different and worse statement than "Pocket cannot see".
 *
 * ## All 18-decimal wei
 *
 * Every figure here is 18-decimal chain value rendered by
 * `lib/mezo/borrow-format.ts` — the same module the Borrow screens use for the
 * same reason — and never by `features/payments/amount.ts`'s `formatUnits`,
 * which speaks the app's 2-decimal minor units. Crossing them is a factor of
 * 10¹⁶.
 *
 * The screen only reads and hands two decisions to `useEarnActions`, which ask
 * the chain before they ask the wallet.
 */
export function VaultScreen({ onBack }: { onBack?: () => void }) {
  const { data, isPending, isError, error, refetch, isFetching } = useEarn();

  return (
    <div className={`${SCREEN} pk-finance ${onBack ? "pk-scr--plain" : ""}`}>
      {onBack ? (
        <ScreenHeader title="Vault" onBack={onBack} />
      ) : (
        <PageHeading title="Vault" />
      )}
      <FinanceIntro title="A little saved. A little earned.">
        Save mUSD in Mezo&apos;s vault and manage your interest here.
      </FinanceIntro>

      {isPending ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState
          title="Could not read your savings"
          description={
            error instanceof Error
              ? error.message
              : "The Mezo network did not answer."
          }
          onRetry={() => refetch()}
        />
      ) : (
        <Vault view={data} refreshing={isFetching} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A read vault                                                                */
/* -------------------------------------------------------------------------- */

function Vault({ view, refreshing }: { view: EarnView; refreshing: boolean }) {
  const actions = useEarnActions();
  const queryClient = useQueryClient();
  const wallet = useMusdBalance();

  const [mode, setMode] = useState<"save" | "out">("save");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(() =>
    actions.pendingClaimHash(),
  );
  const [pendingClaimHash, setPendingClaimHash] = useState<string | null>(() =>
    actions.pendingClaimHash(),
  );

  const principal = BigInt(view.principal);
  const claimable =
    view.claimableYield === null ? null : BigInt(view.claimableYield);

  /*
    What the field is measured against, which is the one number that differs
    between the two directions: saving is bounded by the MUSD in the wallet,
    taking out by the MUSD already in the vault. `null` means unread, and an
    unread ceiling disables the hint rather than pretending the limit is zero.
  */
  const ceiling = mode === "save" ? (wallet.raw ?? null) : principal;

  const parsed = parseDecimalToWei(amount);
  const overCeiling = parsed !== null && ceiling !== null && parsed > ceiling;
  const canSubmit = parsed !== null && parsed > 0n && !overCeiling && !busy;

  /** Both writes end the same way: clear the field, then believe only the chain. */
  async function run() {
    if (parsed === null || parsed <= 0n) return;
    setBusy(true);
    setError(null);
    setHash(null);

    const result =
      mode === "save"
        ? await actions.deposit(parsed)
        : await actions.withdraw(parsed);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      /*
        A broadcast-but-unread write carries its hash, and the field is cleared
        even though the write did not report success — the money may well have
        moved, and leaving the amount in place invites sending it twice.
      */
      if (result.hash) {
        setHash(result.hash);
        setAmount("");
        queryClient.invalidateQueries({ queryKey: ["earn"] });
        void wallet.refetch();
      }
      return;
    }

    setAmount("");
    setHash(result.hash);
    queryClient.invalidateQueries({ queryKey: ["earn"] });
    void wallet.refetch();
  }

  async function claim() {
    setBusy(true);
    setError(null);
    setHash(null);
    const result = await actions.claim();
    setPendingClaimHash(actions.pendingClaimHash());
    if (result.hash) setHash(result.hash);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHash(result.hash);
    queryClient.invalidateQueries({ queryKey: ["earn"] });
    void wallet.refetch();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${UP} pk-finance-hero pk-finance-hero--yellow`}
      >
        <div className="pk-finance-hero-top">
          <p className="pk-eyebrow">Saved</p>
          <VaultIcon size={22} aria-hidden="true" />
        </div>
        <p className="pk-finance-value">
          {formatMusd(principal)} <small>mUSD</small>
        </p>
        <p className="pk-m">
          {view.hasPosition
            ? "MUSD, earning Mezo's savings rate."
            : "Nothing is saved here yet."}
        </p>

        {/*
          Named, because sMUSD is the thing the chain actually holds and a user
          who goes looking on an explorer will find it called that. It is the
          same number as the line above, and saying so here is what stops the
          two from being added together later.
        */}
        {view.hasPosition ? (
          <p className="pk-m" style={{ marginTop: 6 }}>
            Held as {formatMusd(principal)} sMUSD — one for one, not a price.
          </p>
        ) : null}
      </motion.div>

      {/*
        The mismatch guard. `false` is the vault reporting that it is pointed at
        a different MUSD than the one this build transfers, which would make a
        deposit a one-way trip into something the app cannot describe. `null` is
        "not established", which is not the same thing and is not shown at all.
      */}
      {view.vaultAcceptsMusd === false ? (
        <p
          className="pk-m"
          style={{ marginTop: 12, color: "var(--r-ink)", lineHeight: 1.6 }}
        >
          This vault is set up for a different MUSD than the one this app
          transfers, so saving here is switched off until that is checked.
        </p>
      ) : null}

      <div className="pk-interest-card">
        <div className="pk-interest-heading">
          <span className="pk-interest-icon">
            <Sprout size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>Claimable interest</h3>
            <p className="pk-m">
              {claimable === null
                ? "The vault did not answer, so this is withheld"
                : claimable === 0n
                  ? "Nothing has accrued yet"
                  : "Earned so far — claiming moves it to your wallet"}
            </p>
          </div>
        </div>
        <p className="pk-interest-value">
          {claimable === null ? "—" : `${formatMusd(claimable)} MUSD`}
        </p>

        {pendingClaimHash || (claimable !== null && claimable > 0n) ? (
          <div style={{ marginTop: 12 }}>
            <Button
              full
              variant="secondary"
              className="pk-finance-secondary"
              loading={busy}
              onClick={claim}
            >
              {pendingClaimHash ? "Check claim confirmation" : "Claim interest"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="pk-finance-workspace">
        <FinanceTabs
          label="Vault action"
          options={[
            { value: "save", label: "Save" },
            { value: "out", label: "Take out" },
          ]}
          value={mode}
          onChange={(value) => {
            setMode(value);
            setAmount("");
            setError(null);
          }}
          disabled={busy}
        />

        <div style={{ marginTop: 12 }}>
          <AmountField
            symbol="mUSD"
            disabled={busy}
            label={mode === "save" ? "Amount to save" : "Amount to take out"}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            /*
            The ceiling is stated, not enforced by silently truncating the field
            — a number that rewrites itself as you type is how someone saves a
            different amount than they meant to.
          */
            error={
              overCeiling
                ? mode === "save"
                  ? "That is more MUSD than this wallet holds."
                  : "That is more than is saved in this wallet."
                : undefined
            }
            hint={
              ceiling === null
                ? mode === "save"
                  ? "Reading your wallet…"
                  : "Reading the vault…"
                : mode === "save"
                  ? `Available: ${formatMusd(ceiling)} MUSD`
                  : `Saved: ${formatMusd(ceiling)} MUSD`
            }
            onMax={
              ceiling !== null && ceiling > 0n
                ? () => setAmount(weiToDecimalInput(ceiling))
                : undefined
            }
            maxLabel="Use the maximum"
          />
        </div>

        <Button
          full
          className="pk-finance-submit"
          loading={busy}
          disabled={
            (view.vaultAcceptsMusd === false && mode === "save") || !canSubmit
          }
          onClick={run}
        >
          <span>{mode === "save" ? "Save MUSD" : "Take out MUSD"}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>

      {error ? (
        <p
          className="pk-m"
          style={{ marginTop: 12, color: "var(--r-ink)", lineHeight: 1.6 }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {hash ? (
        /*
          `overflowWrap: anywhere` on the paragraph, not `wordBreak: break-all`.
          The hash is a single word with no break opportunity in it, so it needs
          one — but the sentence around it is prose, and `break-all` would break
          "Broadcast" in half as readily as it breaks the hash. This rule only
          breaks a word that cannot fit, which is the hash and nothing else.
        */
        <p
          className="pk-m"
          style={{ marginTop: 12, lineHeight: 1.6, overflowWrap: "anywhere" }}
        >
          {error
            ? `Broadcast as ${hash} — this screen will catch up when it confirms.`
            : `Done. ${hash}`}
        </p>
      ) : null}

      <div className="pk-finance-explainer">
        <div className="pk-row" style={{ alignItems: "flex-start", gap: 10 }}>
          <span className="pk-ico" aria-hidden="true">
            <InfoIcon size={16} />
          </span>
          <p className="pk-m" style={{ lineHeight: 1.6 }}>
            The savings belong to your wallet. Pocket never holds them and
            cannot move them — saving and taking out are both signed by you,
            from the wallet shown on the Receive screen. Interest is paid by
            Mezo&apos;s vault, and it is not guaranteed.
          </p>
        </div>
      </div>

      {/*
        The read refreshes on an interval, so a figure changing on its own is
        named as a check rather than read as the app correcting itself.
      */}
      {refreshing ? (
        <p className="pk-m" style={{ marginTop: 14, textAlign: "center" }}>
          Checking again…
        </p>
      ) : null}
    </>
  );
}
