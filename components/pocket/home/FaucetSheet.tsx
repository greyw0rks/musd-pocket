"use client";

import { CheckIcon } from "@/components/pocket/icons";
import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";
import type { FaucetController } from "@/hooks/use-faucet";
import { explorer } from "@/lib/mezo/explorer";

/**
 * The one-time claim, in a sheet.
 *
 * It has three faces and they map to the three real states of the claim:
 * owed, half-sent, and sent. The last one is deliberately quiet — the money is
 * a testnet allowance, not a win — so it states what moved and offers the two
 * explorer links rather than a receipt screen.
 *
 * The button says "Finish claim" when one leg already has a hash. That is the
 * recoverable state left by a request that died between the transfers, and it
 * is why the sheet does not simply say "claimed" for any row that exists.
 */
export function FaucetSheet({
  open,
  onClose,
  faucet,
}: {
  open: boolean;
  onClose: () => void;
  faucet: FaucetController;
}) {
  const { amounts, claim, funded, claiming, error, claimFaucet, clearError } =
    faucet;

  const sent = Boolean(
    claim?.completedAt || (claim?.btcTxHash && claim?.musdTxHash),
  );

  // A claim in flight owns the sheet: the backdrop and Escape must not leave
  // the user without the one screen that explains what is happening.
  const close = () => {
    if (claiming) return;
    clearError();
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="Testnet faucet">
      {sent ? (
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--g)] text-white">
            <CheckIcon size={24} />
          </span>

          <p className="pk-h2 mt-4">
            {claim?.completedAt ? "Claimed" : "On its way"}
          </p>
          <p className="pk-m mt-2 leading-relaxed">
            {amounts.btc} BTC and {amounts.musd} mUSD were sent to your wallet
            on Mezo testnet.
          </p>

          <div className="mt-4 flex flex-col items-center gap-1.5">
            {claim?.btcTxHash ? (
              <TxLink label="Bitcoin transfer" hash={claim.btcTxHash} />
            ) : null}
            {claim?.musdTxHash ? (
              <TxLink label="mUSD transfer" hash={claim.musdTxHash} />
            ) : null}
          </div>

          <Button full size="lg" className="mt-5" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <p className="pk-m text-center leading-relaxed">
            One claim per account. The Bitcoin pays gas on Mezo; the mUSD is
            yours to send, save and repay with.
          </p>

          <div className="pk-card mt-5 !py-3.5">
            <Row label="Bitcoin for gas" value={`${amounts.btc} BTC`} />
            <Row
              label="mUSD to spend"
              value={`${amounts.musd} mUSD`}
              className="mt-2.5"
            />
          </div>

          {/* The chain answer, not a guess: the funding wallet is read before
              the button is offered. `null` (unread) keeps the button live and
              lets the claim endpoint give the authoritative answer. */}
          {funded === false ? (
            <p className="pk-m mt-4 text-center">
              The faucet is being restocked. Try again soon.
            </p>
          ) : null}

          {error ? (
            <p
              className="mt-4 text-center text-[13px] font-medium leading-relaxed"
              style={{ color: "var(--rd)" }}
            >
              {error}
            </p>
          ) : null}

          <Button
            full
            size="lg"
            className="mt-5"
            loading={claiming}
            disabled={funded === false}
            onClick={() => void claimFaucet()}
          >
            {claim ? "Finish claim" : "Claim faucet"}
          </Button>

          <p className="pk-m mt-3 text-center">Testnet only. No real money.</p>
        </>
      )}
    </Sheet>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`pk-row pk-sp ${className ?? ""}`}>
      <span className="pk-m">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <a
      href={explorer.tx(hash)}
      target="_blank"
      rel="noreferrer"
      className="pk-m underline underline-offset-2"
    >
      {label} · view on explorer
    </a>
  );
}
