"use client";

import { useState } from "react";
import { BadgeCheck, Shirt, Copy, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { GREYLABS, type GreylabsAccess, type GreylabsCoupon } from "@/lib/merchants/greylabs";
import type { Recipient } from "@/features/payments/payment.types";
import { WaitlistCheckout } from "@/components/checkout/WaitlistCheckout";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { Button } from "@/components/pocket/ui/Button";
import { GreylabsMerch } from "./GreylabsMerch";

export function VerifiedMerchants({ onPayMerchant }: { onPayMerchant: (recipient: Recipient) => void }) {
  const api = useApi();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const accessKey = ["greylabs-access", user?.id];
  const access = useQuery({
    queryKey: accessKey,
    queryFn: () => api<GreylabsAccess>("/api/merchants/greylabs/coupon"),
    enabled: open && !!user,
    staleTime: 0,
  });
  const issue = useMutation({
    mutationKey: ["greylabs-coupon", user?.id],
    mutationFn: () => api<GreylabsCoupon>("/api/merchants/greylabs/coupon", { method: "POST" }),
    onSuccess: coupon => queryClient.setQueryData<GreylabsAccess>(accessKey, previous => previous ? { ...previous, coupon } : previous),
  });
  const coupon = access.data?.eligible ? access.data.coupon : null;
  async function copy() {
    if (!coupon) return;
    try { await navigator.clipboard.writeText(coupon.code); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <section aria-label="Verified merchants" className="mt-5">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><BadgeCheck size={17} className="text-[var(--p)]" />Verified merchants</h2>
    <div className="pk-card flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--s2)]"><Shirt size={22} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Greylabs merch</p><p className="pk-m mt-1 text-xs">{GREYLABS.offer} · Pay {GREYLABS.handle}</p></div>
      <button type="button" className="shrink-0 rounded-full bg-[var(--p)] px-3 py-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        onClick={() => { setOpen(true); setBrowsing(false); setCopied(false); issue.reset(); }}>Get discount</button>
    </div>
    <WaitlistCheckout compact />
    <Sheet open={open} onClose={() => setOpen(false)} title={browsing && coupon ? "Greylabs merch" : "Your Greylabs discount"}>
      {browsing && coupon ? <GreylabsMerch coupon={coupon} onBack={() => setBrowsing(false)} /> : <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--s2)]"><Shirt size={28} /></span>
        {access.isPending ? <p className="pk-m mt-5" role="status">Checking your payment…</p> : coupon ? <>
          <p className="mt-5 text-4xl font-semibold">{coupon.percent}% off</p>
          <p className="pk-m mt-2 text-sm">Greylabs merch, made for builders.</p>
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--s2)] p-4"><p className="pk-m text-xs">Your personal discount code</p><p className="mt-2 break-all font-mono text-sm font-semibold select-all">{coupon.code}</p></div>
          <p className="pk-m mt-3 text-xs leading-relaxed">Keep this code and use it when ordering Greylabs merch. Your discount stays the same each time you open Pocket.</p>
          <Button full className="mt-4" onClick={() => void copy()} icon={copied ? <Check size={16} /> : <Copy size={16} />}>{copied ? "Copied" : "Copy code"}</Button>
          {copyError ? <p className="pk-m mt-2 text-xs" role="status">Select and copy the code above.</p> : null}
          <Button full variant="secondary" className="mt-3" onClick={() => setBrowsing(true)}>Explore Greylabs merch</Button>
        </> : access.data?.eligible ? <>
          <p className="mt-5 font-semibold">Payment confirmed</p>
          <p className="pk-m mt-2 text-sm">Reveal your random 10–30% merch discount. It stays the same for your account.</p>
          <Button full className="mt-4" loading={issue.isPending} onClick={() => issue.mutate()}>Reveal discount</Button>
        </> : access.data ? <>
          <p className="mt-5 font-semibold">Pay {GREYLABS.handle} to unlock</p>
          <p className="pk-m mt-2 text-sm">Send any positive mUSD amount to Greylabs. After confirmation, you can reveal your random 10–30% discount code.</p>
          <Button full className="mt-4" disabled={!access.data.recipient} onClick={() => { if (access.data?.recipient) { setOpen(false); onPayMerchant(access.data.recipient); } }}>Pay {GREYLABS.handle}</Button>
          {!access.data.recipient ? <p className="pk-m mt-2 text-xs">Greylabs payments are temporarily unavailable.</p> : null}
          <Button full variant="ghost" className="mt-2" loading={access.isFetching} onClick={() => void access.refetch()}>Check payment</Button>
        </> : null}
        {access.error || issue.error ? <><p role="alert" className="mt-4 text-sm text-[var(--rd)]">{(access.error ?? issue.error)?.message}</p><Button className="mt-4" full onClick={() => { issue.reset(); void access.refetch(); }}>Try again</Button></> : null}
      </div>}
      <Button full variant="ghost" className="mt-2" onClick={() => setOpen(false)}>Close</Button>
    </Sheet>
  </section>;
}
