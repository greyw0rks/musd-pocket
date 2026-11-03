"use client";

import { useState, useSyncExternalStore } from "react";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { checkoutPath } from "@/lib/requests/links";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function PaymentLink({ shortId }: { shortId: string }) {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const url = origin ? new URL(checkoutPath(shortId), origin).href : "";
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
    } catch {
      setMessage("Select the link below and copy it.");
    }
  }
  return (
    <section
      aria-label="Share payment request"
      className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-current/10 p-4"
    >
      <h2 className="font-semibold">Share your payment link</h2>
      {url ? (
        <QrCode value={url} label="Scan to open this payment request" />
      ) : null}
      <input
        aria-label="Payment link"
        className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-xs"
        readOnly
        value={url}
        onFocus={(event) => event.target.select()}
      />
      <button
        type="button"
        disabled={!url}
        onClick={() => void copy()}
        className="rounded-full bg-[#6528e8] px-5 py-2 text-sm font-semibold text-white"
      >
        Copy link
      </button>
      <p role="status" className="text-sm">
        {message || "Scan with your phone camera, or share the link."}
      </p>
    </section>
  );
}
