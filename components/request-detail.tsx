"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Share2, ExternalLink, Check } from "lucide-react";
import { useRequest } from "@/hooks/use-requests";
import { QRCodeView } from "@/components/ui/qr-code";
import { StatusBadge } from "@/components/ui/status-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { explorer } from "@/lib/mezo/explorer";
import { formatAmount } from "@/lib/utils";
import { MUSD_SYMBOL } from "@/lib/mezo/config";

export function RequestDetail({ shortId }: { shortId: string }) {
  const toast = useToast();
  const { data: req, isLoading, isError } = useRequest(shortId, true);
  const [payUrl, setPayUrl] = useState("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setPayUrl(`${base}/pay/${shortId}`);
  }, [shortId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto size-56 rounded-xl" />
        <Skeleton className="mx-auto h-8 w-32" />
      </div>
    );
  }

  if (isError || !req) {
    return (
      <p className="text-center text-muted">This request could not be found.</p>
    );
  }

  const isPaid = req.status === "PAID";

  const share = async () => {
    if (navigator.share) {
      await navigator
        .share({ title: "mUSD payment request", url: payUrl })
        .catch(() => {});
    } else {
      await navigator.clipboard.writeText(payUrl);
      toast("success", "Link copied");
    }
  };

  return (
    <div className="space-y-6 text-center">
      {isPaid ? (
        <div className="flex flex-col items-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-success-soft">
            <Check className="size-8 text-success" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">
            Payment received
          </h1>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-foreground">
            Request created
          </h1>
          <div className="flex justify-center">
            <QRCodeView value={payUrl} />
          </div>
        </>
      )}

      <div>
        <p className="tabular text-4xl font-semibold text-foreground">
          {formatAmount(req.amount)}{" "}
          <span className="text-lg font-normal text-muted">{MUSD_SYMBOL}</span>
        </p>
        {req.description && (
          <p className="mt-1 text-muted">{req.description}</p>
        )}
        <div className="mt-3 flex justify-center">
          <StatusBadge status={req.status} />
        </div>
      </div>

      {!isPaid && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-surface py-3">
              <CopyButton value={payUrl} label="Copy link" />
            </div>
            <Button variant="secondary" onClick={share} className="flex-1">
              <Share2 className="size-4" /> Share
            </Button>
          </div>
        </div>
      )}

      {isPaid && req.txHash && (
        <a
          href={explorer.tx(req.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          View transaction <ExternalLink className="size-4" />
        </a>
      )}

      <div className="border-t border-border pt-4 text-sm text-muted">
        <p>
          Request ID{" "}
          <span className="font-mono text-foreground">{req.displayId}</span>
        </p>
      </div>

      <Link
        href="/requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All requests
      </Link>
    </div>
  );
}
