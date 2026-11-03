"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatEther } from "viem";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { Button } from "@/components/pocket/ui/Button";
import { EXPLORER_URL } from "@/lib/mezo/config";
import type { WealthAction } from "@/hooks/use-wealth-action";

export function ActionReview({ action }: { action: WealthAction }) {
  const { plan, receipt, step } = action;
  const [acknowledgedRequest, setAcknowledgedRequest] = useState<string | null>(
    null,
  );
  const unsent = Boolean(receipt && acknowledgedRequest === receipt.requestId);
  const setUnsent = (value: boolean) =>
    setAcknowledgedRequest(value ? (receipt?.requestId ?? null) : null);
  const review = (
    <Sheet
      open={action.open}
      onClose={action.close}
      title={plan?.title ?? "Wallet action"}
    >
      {plan ? (
        <>
          <p className="pk-m">
            Mezo testnet · your Pocket wallet signs each step.
          </p>
          <dl className="mt-4 space-y-3 rounded-2xl bg-[var(--s2)] p-4 text-[13px]">
            {plan.details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-4">
                <dt className="pk-m shrink-0 max-w-[45%]">{detail.label}</dt>
                <dd
                  className="min-w-0 break-words text-right"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {detail.value}
                </dd>
              </div>
            ))}
            {step ? (
              <div className="flex justify-between gap-4">
                <dt className="pk-m">Estimated fee for this step</dt>
                <dd className="break-all text-right">
                  {formatEther(step.estimatedFee)} BTC
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
      {step?.kind === "approval" ? (
        <p className="pk-m mt-3">
          This step updates a token allowance. After it confirms, review the
          next step to complete your action.
        </p>
      ) : null}
      {action.busy ? (
        <p className="pk-m mt-4" role="status">
          {step
            ? "Confirm in your wallet, then wait for the receipt…"
            : "Checking the transaction…"}
        </p>
      ) : null}
      {action.error ? (
        <p className="mt-4 text-[13px] text-[var(--r-ink)]" role="alert">
          {action.error}
        </p>
      ) : null}
      {receipt ? (
        <div className="mt-4 text-[13px]" role="status">
          <p>
            {receipt.status === "confirmed"
              ? `${receipt.kind === "approval" ? "Approval" : "Transaction"} confirmed.`
              : receipt.status === "pending"
                ? receipt.hash
                  ? "Transaction sent. Check its confirmation here; do not repeat it."
                  : "The submission result is unknown."
                : "Transaction reverted."}
          </p>
          {receipt.hash ? (
            <a
              className="mt-2 inline-block underline"
              href={`${EXPLORER_URL}/tx/${receipt.hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View transaction receipt
            </a>
          ) : (
            <div className="mt-3">
              <p>
                The wallet did not return a transaction hash. Check your wallet
                history before starting another action.
              </p>
              <label className="mt-3 flex gap-2">
                <input
                  type="checkbox"
                  checked={unsent}
                  onChange={(event) => setUnsent(event.target.checked)}
                />
                My wallet shows that this request was never sent.
              </label>
              <Button
                full
                variant="secondary"
                className="mt-3"
                disabled={!unsent || action.busy}
                onClick={() => {
                  action.clearUnsent();
                  setUnsent(false);
                }}
              >
                Clear unsent request
              </Button>
              <p className="pk-m mt-2">
                Clearing this record does not cancel any transaction already
                sent.
              </p>
            </div>
          )}
        </div>
      ) : null}
      {step && receipt?.status !== "pending" ? (
        <Button
          full
          className="mt-5"
          loading={action.busy}
          onClick={() => void action.confirm()}
        >
          {step.label}
        </Button>
      ) : null}
      {receipt?.status === "pending" ? (
        <Button
          full
          className="mt-5"
          loading={action.busy}
          onClick={() => void action.check()}
        >
          Check confirmation
        </Button>
      ) : null}
      {action.error && !step && receipt?.status !== "pending" ? (
        <Button
          full
          className="mt-4"
          variant="secondary"
          disabled={action.busy}
          onClick={action.retry}
        >
          Refresh quote
        </Button>
      ) : null}
      <Button
        full
        className="mt-2"
        variant="ghost"
        disabled={action.busy}
        onClick={action.close}
      >
        {receipt?.status === "confirmed" && receipt.kind === "action"
          ? "Done"
          : "Close"}
      </Button>
    </Sheet>
  );
  // Keep the review above the dock and outside the screen's scroll container.
  const host =
    typeof document === "undefined"
      ? null
      : document.querySelector(".pocket-root .pk-app");
  return (
    <>
      {receipt ? (
        <div className="pk-card mt-4 text-[13px]" role="status">
          <p>
            {receipt.title}:{" "}
            {receipt.status === "pending"
              ? "awaiting confirmation"
              : receipt.status}
            .
          </p>
          <Button variant="secondary" className="mt-2" onClick={action.reopen}>
            {receipt.status === "pending"
              ? "Check confirmation"
              : "View receipt"}
          </Button>
        </div>
      ) : null}
      {host ? createPortal(review, host) : review}
    </>
  );
}
