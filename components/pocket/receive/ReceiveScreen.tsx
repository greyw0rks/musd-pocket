"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  AtSignIcon,
  CheckIcon,
  CopyIcon,
  ShareIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";

/**
 * Receive.
 *
 * The screen is about the wallet address, because that is the thing that gets
 * paid. A link would be a worse answer: some wallets want EIP-681 and some want
 * the bare address, and guessing which would put a scheme on screen that may or
 * may not resolve. A plain address is readable by anything, including a human.
 *
 * So the QR encodes the address itself, the address is printed in full and
 * selectable underneath, and the second button copies it — and says so. "Copy
 * payment link" would promise a link with a payer at the end of it, and there is
 * not one.
 *
 * Before the wallet exists there is nothing to show. The plate stays and the
 * code does not, because filling that space with anything else would be a code
 * that cannot be paid.
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
  const [copied, setCopied] = useState<"handle" | "code" | null>(null);
  const [failed, setFailed] = useState(false);

  /*
    The same wallet object the account overview reads. One source, so this screen
    and that one cannot disagree about whether a wallet exists — which is the
    failure that made the overview's Wallet row wrong in the first place.
  */
  const { session } = usePocket();
  const address =
    session?.wallet.status === "ready" ? session.wallet.address : undefined;

  /*
    `undefined` here means the wallet is still being minted, and the screen says
    that rather than showing a code that cannot be paid.
  */
  const code = address;

  /**
   * Clipboard access is denied in a few browsers and in any non-secure
   * context. When that happens the user is told rather than shown a tick that
   * did not happen — the details are on screen and selectable either way, so
   * this is an inconvenience and not a dead end.
   */
  async function copy(what: "handle" | "code", text: string) {
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
   * button next to it already is the fallback. It is also guarded on there
   * being something to share, since there is a window before the wallet exists
   * when there is not.
   */
  async function share() {
    if (!code) return;
    const payload = { title: `Pay ${name}`, text: code };
    try {
      await navigator.share(payload);
    } catch {
      // Dismissing the sheet rejects, which is not a failure worth reporting.
    }
  }

  const canShare =
    typeof navigator !== "undefined" && "share" in navigator && Boolean(code);

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
        {code ? (
          <div className="mt-6 rounded-2xl bg-white p-3">
            <QrCode value={code} size={196} label={`Address for ${name}`} />
          </div>
        ) : (
          <div className="mt-6 flex h-[220px] w-[220px] items-center justify-center rounded-2xl bg-white p-4">
            <p className="text-center text-[13px] font-semibold text-neutral-500">
              Setting up your wallet. There is no address to show yet.
            </p>
          </div>
        )}

        {/*
          The address in full, wrapping rather than truncating. It is the whole
          thing the other person needs and the only thing on this screen they
          cannot guess, so shortening it would turn the one surface that has it
          into a second place to be told "not connected".
        */}
        <p className="mt-5 w-full px-2 text-center font-mono text-[12px] leading-relaxed break-all">
          {address ?? "—"}
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
          disabled={!code}
          icon={
            copied === "code" ? <CheckIcon size={16} /> : <CopyIcon size={16} />
          }
          onClick={() => {
            if (code) void copy("code", code);
          }}
        >
          {copied === "code" ? "Address copied" : "Copy address"}
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
          This browser blocked the clipboard. The address is above — select it
          and copy by hand.
        </p>
      ) : null}

      {/*
        The useful fact is not that some scheme is unimplemented — it is which
        network money has to arrive on, because a transfer from anywhere else is
        gone. Nothing here claims the app's balance will show it; that is the
        deposit watcher's job, and it is not this screen's statement to make.
      */}
      <p className="pk-m mt-5 px-2 text-center leading-relaxed">
        This is your wallet address on Mezo testnet. Send MUSD on that same
        network — a transfer from anywhere else cannot arrive.
      </p>
    </div>
  );
}
