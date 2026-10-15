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
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { payLink } from "@/features/payments/paylink";

/**
 * Receive.
 *
 * Two ways to be paid, and the mode decides which one this screen is about.
 *
 * In the fixtures there is no address, so the code carries a `pocket:@alex`
 * link. The code is real — `QrCode` encodes the actual link with the same
 * library a wallet would — but the *scheme* is not: nothing resolves `pocket:`,
 * and the note at the bottom says so instead of letting the code imply
 * otherwise.
 *
 * `/home` has an address, and a link nothing can read would be a worse answer
 * than the one thing that works. So the real app shows the wallet address: a QR
 * of the address itself, in full and selectable, with the address as the copy
 * target. No invented URI — some wallets want EIP-681 and some want the bare
 * address, and guessing which would put a scheme on screen that may or may not
 * resolve. A plain address is readable by anything, including a human.
 *
 * Which is why the second button copies "whatever the code carries" and says
 * which thing that is, rather than always promising a payment link: in the real
 * app there is no link behind it, only an address.
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
    The same store read `DemoBadge` makes and the same wallet object the account
    overview reads. One source, so this screen and that one cannot disagree
    about whether a wallet exists — which is the failure that made the overview's
    Wallet row wrong in the first place.
  */
  const { demoMode, session } = usePocket();
  const address =
    session?.wallet.status === "ready" ? session.wallet.address : undefined;

  const link = payLink(handle);

  /*
    What the code carries and what the copy button copies. In the real app that
    is the address; `undefined` here means the wallet is still being minted, and
    the screen says that rather than encoding a link this network cannot pay.
  */
  const real = !demoMode;
  const code = real ? address : link;

  /*
    The second button copies whatever the code carries, so it says which thing
    that is. "Copy payment link" in the real app would promise a link with a
    payer at the end of it, and there is not one.
  */
  const codeIdle = real ? "Copy address" : "Copy payment link";
  const codeDone = real ? "Address copied" : "Link copied";

  /**
   * Clipboard access is denied in a few browsers and in any non-secure
   * context. When that happens the user is told rather than shown a tick that
   * did not happen — the username is on screen and selectable either way, so
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
   * being something to share, since in the real app there is a window before
   * the wallet exists when there is not.
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
            <QrCode
              value={code}
              size={196}
              label={real ? `Address for ${name}` : `Payment code for ${handle}`}
            />
          </div>
        ) : (
          /*
            Real mode, wallet still being minted. The plate stays and the code
            does not, because the alternative — drawing the payment link here to
            fill the space — is the one thing this screen must not do: a signed-in
            user pointing a camera at it would get a link nothing can pay.
          */
          <div className="mt-6 flex h-[220px] w-[220px] items-center justify-center rounded-2xl bg-white p-4">
            <p className="text-center text-[13px] font-semibold text-neutral-500">
              Setting up your wallet. There is no address to show yet.
            </p>
          </div>
        )}

        {real ? (
          /*
            The address in full, wrapping rather than truncating. It is the
            whole thing the other person needs and the only thing on this screen
            they cannot guess, so shortening it would turn the one surface that
            has it into a second place to be told "not connected".
          */
          <p className="mt-5 w-full px-2 text-center font-mono text-[12px] leading-relaxed break-all">
            {address ?? "—"}
          </p>
        ) : (
          <p className="mt-5 truncate text-[22px] font-bold tracking-tight">
            {handle}
          </p>
        )}
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
            copied === "code" ? (
              <CheckIcon size={16} />
            ) : real ? (
              <CopyIcon size={16} />
            ) : (
              <LinkIcon size={16} />
            )
          }
          onClick={() => {
            if (code) void copy("code", code);
          }}
        >
          {copied === "code" ? codeDone : codeIdle}
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
          This browser blocked the clipboard. {real ? "The address" : "The username"}{" "}
          is above — select it and copy by hand.
        </p>
      ) : null}

      <div className="mt-5 flex justify-center">
        <DemoBadge label="Demo — nothing is chargeable" />
      </div>

      {real ? (
        /*
          The sentence the fixtures cannot make. In the real app the wallet is
          live on Mezo testnet, and the useful fact is not that some scheme is
          unimplemented — it is which network money has to arrive on, because a
          transfer from anywhere else is gone. Nothing here claims the app's
          balance will show it; that is the deposit watcher's job, and it is not
          this screen's statement to make.
        */
        <p className="pk-m mt-3 px-2 text-center leading-relaxed">
          This is your wallet address on Mezo testnet. Send MUSD on that same
          network — a transfer from anywhere else cannot arrive.
        </p>
      ) : (
        <p className="pk-m mt-3 px-2 text-center leading-relaxed">
          The code above is a real QR encoding{" "}
          <span className="text-[var(--t)]">{link}</span>. No wallet understands
          that scheme yet — Mezo wiring is what makes it payable, and until then
          nobody can send you anything by scanning it.
        </p>
      )}
    </div>
  );
}
