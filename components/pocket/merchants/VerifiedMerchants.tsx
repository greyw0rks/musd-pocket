"use client";

import { useState } from "react";
import { BadgeCheck, Shirt, Copy, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { GREYLABS, type GreylabsCoupon } from "@/lib/merchants/greylabs";
import { WaitlistCheckout } from "@/components/checkout/WaitlistCheckout";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { Button } from "@/components/pocket/ui/Button";

export function VerifiedMerchants() {
  const api = useApi();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const coupon = useMutation({
    mutationKey: ["greylabs-coupon", user?.id],
    mutationFn: () => api<GreylabsCoupon>("/api/merchants/greylabs/coupon", { method: "POST" }),
  });
  async function copy() {
    if (!coupon.data) return;
    try { await navigator.clipboard.writeText(coupon.data.code); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <section aria-label="Verified merchants" className="mt-5">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><BadgeCheck size={17} className="text-[var(--p)]" />Verified merchants</h2>
    <div className="pk-card flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--s2)]"><Shirt size={22} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Greylabs merch</p><p className="pk-m mt-1 text-xs">{GREYLABS.offer}</p></div>
      <button type="button" className="shrink-0 rounded-full bg-[var(--p)] px-3 py-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        onClick={() => { setOpen(true); setCopied(false); if (!coupon.data) coupon.mutate(); }}>Get discount</button>
    </div>
    <WaitlistCheckout compact />
    <Sheet open={open} onClose={() => setOpen(false)} title="Your Greylabs discount">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--s2)]"><Shirt size={28} /></span>
        {coupon.isPending ? <p className="pk-m mt-5" role="status">Revealing your discount…</p> : coupon.data ? <>
          <p className="mt-5 text-4xl font-semibold">{coupon.data.percent}% off</p>
          <p className="pk-m mt-2 text-sm">Greylabs merch, made for builders.</p>
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--s2)] p-4"><p className="pk-m text-xs">Your personal discount code</p><p className="mt-2 break-all font-mono text-sm font-semibold select-all">{coupon.data.code}</p></div>
          <p className="pk-m mt-3 text-xs leading-relaxed">Keep this code and use it when ordering Greylabs merch. Your discount stays the same each time you open Pocket.</p>
          <Button full className="mt-4" onClick={() => void copy()} icon={copied ? <Check size={16} /> : <Copy size={16} />}>{copied ? "Copied" : "Copy code"}</Button>
          {copyError ? <p className="pk-m mt-2 text-xs" role="status">Select and copy the code above.</p> : null}
          <a href={`${GREYLABS.shopUrl}?code=${encodeURIComponent(coupon.data.code)}`} className="mt-3 block rounded-full bg-[var(--s2)] px-4 py-3 text-sm font-semibold">Explore Greylabs merch</a>
        </> : null}
        {coupon.error ? <><p role="alert" className="mt-4 text-sm text-[var(--rd)]">{coupon.error.message}</p><Button className="mt-4" full onClick={() => coupon.mutate()}>Try again</Button></> : null}
      </div>
      <Button full variant="ghost" className="mt-2" onClick={() => setOpen(false)}>Close</Button>
    </Sheet>
  </section>;
}
