"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, AtSign, ChevronDown } from "lucide-react";
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

export default function PayPage() {
  const { user, refresh } = useSession();
  const api = useApi();
  const idem = useIdempotencyKey();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const available = Number(user?.availableBalance ?? "0");
  const amountNum = Number(amount || "0");
  const overBalance = amountNum > available;
  const canSubmit =
    amountNum > 0 && !overBalance && recipient.trim() !== "" && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api<{ counterparty: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          amount,
          recipient: recipient.trim(),
          note: note.trim() || undefined,
          idempotencyKey: idem.current(),
        }),
      });
      idem.rotate();
      toast("success", `Sent ${formatAmount(amount)} ${MUSD_SYMBOL} to ${res.counterparty}`);
      setAmount("");
      setRecipient("");
      setNote("");
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
      ]);
    } catch (e) {
      idem.settleError(e);
      toast("error", e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ArrowUpRight className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Send MUSD</h1>
          <p className="text-sm text-muted">Pay anyone — Pocket picks the chain.</p>
        </div>
      </header>

      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <div className="px-1 text-[13px] text-muted">
        Available: <span className="tabular text-foreground">{formatAmount(available)}</span>{" "}
        {MUSD_SYMBOL}
        {overBalance && <span className="ml-2 text-error">Not enough balance</span>}
      </div>

      <div>
        <Label htmlFor="recipient">To</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            id="recipient"
            placeholder="username or 0x address"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="pl-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          placeholder="What's it for?"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Chain is a detail, not a decision — tucked away by design. */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-foreground"
        >
          Details
          <ChevronDown className={showDetails ? "size-4 rotate-180 transition" : "size-4 transition"} />
        </button>
        {showDetails && (
          <Card className="mt-2">
            <CardBody className="flex items-center justify-between py-3.5 text-sm">
              <span className="text-muted">Delivered on</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[13px] font-medium text-primary">
                {chainLabel("MEZO")}
              </span>
            </CardBody>
          </Card>
        )}
      </div>

      <Button fullWidth size="lg" loading={submitting} disabled={!canSubmit} onClick={submit}>
        {amountNum > 0 ? `Send ${formatAmount(amount)} ${MUSD_SYMBOL}` : "Send"}
      </Button>
    </div>
  );
}
