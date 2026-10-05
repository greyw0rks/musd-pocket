"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine, ShieldCheck } from "lucide-react";
import { isAddress } from "viem";
import { useSession } from "@/lib/auth/session";
import { useApi } from "@/lib/auth/client";
import { useIdempotencyKey } from "@/lib/idempotency";
import { useToast } from "@/components/ui/toast";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { MUSD_SYMBOL } from "@/lib/mezo/config";
import { chainLabel } from "@/lib/chain-display";
import { formatAmount } from "@/lib/utils";

export default function WithdrawPage() {
  const { user, refresh } = useSession();
  const api = useApi();
  const idem = useIdempotencyKey();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const available = Number(user?.availableBalance ?? "0");
  const amountNum = Number(amount || "0");
  const overBalance = amountNum > available;
  const addressValid = isAddress(toAddress.trim());
  const canSubmit =
    amountNum > 0 && !overBalance && addressValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api<{ txHash: string }>("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({
          amount,
          toAddress: toAddress.trim(),
          idempotencyKey: idem.current(),
        }),
      });
      idem.rotate();
      toast("success", `Sent ${formatAmount(amount)} ${MUSD_SYMBOL} to your address`);
      setAmount("");
      setToAddress("");
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ["withdrawals"] }),
      ]);
      void res;
    } catch (e) {
      idem.settleError(e);
      toast("error", e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ArrowUpFromLine className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Withdraw</h1>
          <p className="text-sm text-muted">Cash out to any external address.</p>
        </div>
      </header>

      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <div className="flex items-center justify-between px-1 text-[13px]">
        <span className="text-muted">
          Available: <span className="tabular text-foreground">{formatAmount(available)}</span>{" "}
          {MUSD_SYMBOL}
        </span>
        <button
          type="button"
          className="font-medium text-primary"
          onClick={() => setAmount(available > 0 ? String(available) : "")}
        >
          Max
        </button>
      </div>
      {overBalance && (
        <p className="px-1 text-[13px] text-error">Amount exceeds your available balance.</p>
      )}

      <div>
        <Label htmlFor="to">Destination address</Label>
        <Input
          id="to"
          placeholder="0x…"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          className="font-mono text-[13px]"
          autoComplete="off"
          spellCheck={false}
        />
        {toAddress.trim() !== "" && !addressValid && (
          <p className="mt-1.5 text-[13px] text-error">That doesn&apos;t look like a valid address.</p>
        )}
      </div>

      <Card>
        <CardBody className="flex items-center justify-between py-3.5">
          <span className="text-sm text-muted">Network</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[13px] font-medium text-primary">
            {chainLabel("MEZO")}
          </span>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
        <ShieldCheck className="size-4 shrink-0 text-success" />
        Network fee is covered by Pocket — you receive the full amount.
      </div>

      <Button fullWidth size="lg" loading={submitting} disabled={!canSubmit} onClick={submit}>
        Withdraw {amountNum > 0 ? `${formatAmount(amount)} ${MUSD_SYMBOL}` : MUSD_SYMBOL}
      </Button>
    </div>
  );
}
