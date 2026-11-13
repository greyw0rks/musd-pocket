"use client";

import { useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Button } from "@/components/ui/button";
import { usePocketTheme } from "@/components/pocket/theme-mode";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { WAITLIST_OFFER } from "@/lib/waitlist/offer";
import { Checkout } from "./Checkout";
import { BadgeCheck, KeyRound } from "lucide-react";

// The portal follows Pocket's theme, including the existing checkout controls.
const popupStyle = {
  background: "var(--s)",
  "--background": "var(--bg)",
  "--surface": "var(--s2)",
  "--border": "var(--line)",
  "--foreground": "var(--t)",
  "--muted": "var(--m)",
  "--primary": "var(--p)",
  "--primary-dark": "var(--p)",
  "--error": "var(--r-ink)",
} as CSSProperties;

export function WaitlistCheckout({ compact = false }: { compact?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const { resolved } = usePocketTheme();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="pk-card mt-4 flex items-center justify-between gap-3 p-4">
        {compact ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--s2)]"><KeyRound size={22} /></span> : null}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">{compact ? "Pocket mainnet access" : "Pocket on mainnet"}{compact ? <BadgeCheck size={13} className="text-[var(--p)]" /> : null}</p>
          <p className="pk-m mt-1 text-xs">{compact ? "100 testnet mUSD · closed pilot waitlist" : "Join the closed pilot waitlist"}</p>
        </div>
        <DialogTrigger asChild>
          <button type="button" className="shrink-0 rounded-full bg-[var(--p)] px-4 py-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
            Join waitlist
          </button>
        </DialogTrigger>
      </div>
      <DialogContent data-theme={resolved} style={popupStyle} className="pocket-root max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-[var(--line)] p-5 sm:max-w-[420px]">
        <div className="pr-6">
          <DialogTitle className="text-xl leading-snug">Mainnet waitlist</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-[var(--m)]">
            Join Pocket&apos;s closed mainnet pilot waitlist for {WAITLIST_OFFER.amount} testnet mUSD. This pilot payment does not activate mainnet access.
          </DialogDescription>
        </div>
        <WaitlistPayment />
      </DialogContent>
    </Dialog>
  );
}

function WaitlistPayment() {
  const { walletAddress } = useSession();
  const api = useApi();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["waitlist-checkout", walletAddress],
    enabled: Boolean(walletAddress),
    retry: false,
    queryFn: async () => {
      const request = await api<SerializedRequest>("/api/waitlist/checkout", { method: "POST" });
      cache.setQueryData(["checkout", request.shortId, walletAddress], request);
      return request;
    },
  });
  if (query.isError)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-[var(--r-ink)]">{query.error.message}</p>
        <Button fullWidth variant="secondary" onClick={() => void query.refetch()}>Try again</Button>
      </div>
    );
  if (!query.data)
    return <p role="status" className="py-6 text-center text-sm text-[var(--m)]">Preparing your checkout…</p>;
  return <Checkout shortId={query.data.shortId} embedded />;
}
