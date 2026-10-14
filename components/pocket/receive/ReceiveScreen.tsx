"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  AtSignIcon,
  CheckIcon,
  CopyIcon,
  LinkIcon,
  ShareIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { payLink } from "@/features/payments/paylink";

/**
 * Receive.
 *
 * The code is real. `QrCode` encodes the actual payment link with the same
 * library a wallet would, so pointing a phone at this screen reads back
 * `pocket:@alex` rather than a pretty grid. What is *not* real is the scheme:
 * nothing resolves `pocket:` yet, and the note at the bottom says so instead of
 * letting the code imply otherwise.
 *
 * Three ways to hand the same identity over — show it, copy the username, copy
 * the link — because the useful one depends on whether the other person is
 * standing next to you or on a call.
 */
export function ReceiveScreen({
  name,
  handle,
  avatarUrl,
  onBack,
  onRequestAmount,
}: {
  name: string;
  handle: string;
  avatarUrl?: string;
  onBack: () => void;
  onRequestAmount: () => void;
}) {
  const [copied, setCopied] = useState<"handle" | "link" | null>(null);
  const [failed, setFailed] = useState(false);

  const link = payLink(handle);

  /**
   * Clipboard access is denied in a few browsers and in any non-secure
   * context. When that happens the user is told rather than shown a tick that
   * did not happen — the username is on screen and selectable either way, so
   * this is an inconvenience and not a dead end.
   */
  async function copy(what: "handle" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setFailed(true);
    }
  }

  /**
   * The share sheet, where the platform has one.
   *
   * Guarded on presence rather than tried and caught: `navigator.share` is
   * undefined on desktop, and there is no honest fallback to offer — the copy
   * button next to it already is the fallback.
   */
  async function share() {
    const payload = { title: `Pay ${name}`, text: link };
    try {
      await navigator.share(payload);
    } catch {
      // Dismissing the sheet rejects, which is not a failure worth reporting.
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Receive"
        subtitle="Your payment details"
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
          src={avatarUrl}
          size={56}
          className="ring-2 ring-[var(--s2)]"
        />

        <p className="mt-3 text-[14px] font-bold">{name}</p>

        {/*
          The one surface in the app that is white in both themes, and on
          purpose: a QR code needs a light field to be read by a camera, and a
          code inverted for dark mode would simply not scan. Framing it inside
          the themed card is what keeps that a deliberate plate rather than a
          light card sitting on a dark screen.
        */}
        <div className="mt-6 rounded-2xl bg-white p-3">
          <QrCode value={link} size={196} label={`Payment code for ${handle}`} />
        </div>

        <p className="mt-5 truncate text-[22px] font-bold tracking-tight">
          {handle}
        </p>
      </motion.div>

      <div className="mt-4 space-y-2">
        <Button
          full
          size="lg"
          variant="secondary"
          icon={copied === "handle" ? <CheckIcon size={16} /> : <AtSignIcon size={16} />}
          onClick={() => void copy("handle", handle)}
        >
          {copied === "handle" ? "Username copied" : "Copy username"}
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

        <Button full size="lg" onClick={onRequestAmount}>
          Ask for a specific amount
        </Button>
      </div>

      {failed ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-[color-mix(in_srgb,var(--y)_42%,var(--t))]">
          This browser blocked the clipboard. The username is above — select it
          and copy by hand.
        </p>
      ) : null}

      <div className="mt-5 flex justify-center">
        <DemoBadge label="Demo — nothing is chargeable" />
      </div>

      <p className="pk-m mt-3 px-2 text-center leading-relaxed">
        The code above is a real QR encoding{" "}
        <span className="text-[var(--t)]">{link}</span>. No wallet understands
        that scheme yet — Mezo wiring is what makes it payable, and until then
        nobody can send you anything by scanning it.
      </p>
    </div>
  );
}
