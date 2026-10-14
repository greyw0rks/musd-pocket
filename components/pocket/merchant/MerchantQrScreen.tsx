"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  AtSignIcon,
  CheckIcon,
  LinkIcon,
  ReceiveIcon,
  ShareIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { payLink } from "@/features/payments/paylink";

/**
 * Merchant QR code (Section 6, screen 30).
 *
 * The standing code — no amount, printed once and left on the counter. It is
 * the merchant counterpart of the personal receive screen and it shares its
 * link format, but the presentation differs on purpose: this one is sized to be
 * read across a counter and to be screenshotted or printed, where the personal
 * one is sized to be held up between two people.
 *
 * Scanning it opens whatever the payer chooses to pay, which is the honest
 * behaviour for a code with no price on it: a counter code is an address, not
 * a bill. Charging a specific amount is a different act and lives on screen 29.
 */
export function MerchantQrScreen({ onBack }: { onBack: () => void }) {
  const { session, push } = usePocket();

  const name =
    session?.user.businessName || session?.user.name || "Your business";
  const handle = session?.user.handle || "@yourbusiness";
  const link = payLink(handle);

  const [copied, setCopied] = useState<"handle" | "link" | null>(null);
  const [failed, setFailed] = useState(false);

  async function copy(what: "handle" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard access is denied in insecure contexts and some browsers. The
      // handle is on screen and selectable either way, so this is an
      // inconvenience rather than a dead end — but it is reported, not hidden.
      setFailed(true);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Pay ${name}`, text: link });
    } catch {
      // Dismissing the share sheet rejects. That is not a failure.
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Counter code"
        subtitle="Leave this open for customers"
        onBack={onBack}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="pk-card flex flex-col items-center"
      >
        <Avatar
          name={name}
          size={52}
          className="ring-2 ring-[var(--s2)]"
        />
        <p className="mt-3 text-[14px] font-bold">{name}</p>

        {/* White in both themes so the code stays readable to a camera; the
            themed card around it is what keeps that from looking like a bug. */}
        <div className="mt-6 rounded-2xl bg-white p-3">
          <QrCode value={link} size={216} label={`Counter code for ${handle}`} />
        </div>

        <p className="mt-5 truncate text-[22px] font-bold tracking-tight">
          {handle}
        </p>
        <p className="pk-m mt-1">Scan to pay any amount</p>
      </motion.div>

      <div className="mt-4 space-y-2">
        <Button
          full
          size="lg"
          icon={<ReceiveIcon size={16} />}
          onClick={() => push("merchant-receive")}
        >
          Charge a set amount instead
        </Button>

        <Button
          full
          size="lg"
          variant="secondary"
          icon={copied === "link" ? <CheckIcon size={16} /> : <LinkIcon size={16} />}
          onClick={() => void copy("link", link)}
        >
          {copied === "link" ? "Link copied" : "Copy payment link"}
        </Button>

        <Button
          full
          size="lg"
          variant="secondary"
          icon={copied === "handle" ? <CheckIcon size={16} /> : <AtSignIcon size={16} />}
          onClick={() => void copy("handle", handle)}
        >
          {copied === "handle" ? "Username copied" : "Copy username"}
        </Button>

        {canShare ? (
          <Button
            full
            size="lg"
            variant="secondary"
            icon={<ShareIcon size={16} />}
            onClick={() => void share()}
          >
            Share
          </Button>
        ) : null}
      </div>

      {failed ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-[color-mix(in_srgb,var(--y)_42%,var(--t))]">
          This browser blocked the clipboard. The username is above — select it
          and copy by hand.
        </p>
      ) : null}

      <div className="mt-5 flex justify-center">
        <DemoBadge label="Demo — not chargeable" />
      </div>

      <p className="pk-m mt-3 px-2 text-center leading-relaxed">
        A real QR encoding <span className="text-[var(--t)]">{link}</span>, with
        no amount in it — the customer decides what to pay. Nothing resolves
        that scheme yet, so this cannot take money until Mezo is wired.
      </p>
    </div>
  );
}
