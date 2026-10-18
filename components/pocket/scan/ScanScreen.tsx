"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  ChevronRightIcon,
  QrIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { parsePayLink } from "@/features/payments/paylink";
import type { ResolveHandleResult } from "@/features/contacts/api-contact.adapter";
import type { Recipient } from "@/features/payments/payment.types";
import { formatMoney } from "@/lib/formatters";

/**
 * Scan to pay.
 *
 * There is no camera here, and the screen says so in its first sentence rather
 * than showing a viewfinder over a black rectangle. A fake scanner is the one
 * prop that cannot survive contact — it would look perfect and do nothing, and
 * the person pointing a phone at it would be the one to find out.
 *
 * What a scanner would fall back to when a code will not read is typing the
 * handle, so that is what this screen is: a real, working way in, labelled as
 * the fallback rather than dressed up as the feature. It resolves the handle
 * through the store, which in the real app is the same directory lookup the
 * add-contact flow uses — so a name that resolves here is a name that can
 * actually be paid, and one that does not is refused for that reason rather
 * than because it was absent from a list this screen happened to hold.
 */
export function ScanScreen({
  onBack,
  onResolve,
  onResolved,
  onOpenReceive,
}: {
  onBack: () => void;
  /** Resolve a handle to somebody payable. Async, and it can refuse. */
  onResolve: (handle: string) => Promise<ResolveHandleResult>;
  /** Hands a resolved destination, and any amount the link carried, to the transfer flow. */
  onResolved: (recipientId: string, amountUnits?: bigint) => void;
  onOpenReceive: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<{
    recipient: Recipient;
    amountUnits?: bigint;
  } | null>(null);

  async function resolve() {
    if (looking) return;
    setError(null);
    setPreview(null);

    const parsed = parsePayLink(text);
    if (!parsed) {
      setError(
        "That is not a Pocket username or payment link. Try @someone or pocket:@someone.",
      );
      return;
    }

    /*
      Lookups cost a round-trip and the button is the only way to start one, so
      it is held shut while one is in flight — a second press would be a second
      request for the same name.
    */
    setLooking(true);
    try {
      const result = await onResolve(parsed.handle);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview({ recipient: result.recipient, amountUnits: parsed.amountUnits });
    } catch {
      setError(
        "That lookup did not go through. Check your connection and try again.",
      );
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Scan to pay" onBack={onBack} />

      {/*
        The disc carries the glyph of the thing that is missing rather than a
        crossed-out camera. A QR symbol on a quiet surface, next to a sentence
        beginning "this build has no camera", reads as one statement; a
        struck-through camera would be a second, angrier way of saying it.
      */}
      <div className="pk-card flex flex-col items-center px-6 py-8 text-center">
        {/* `.pk-ico` already draws this surface; repeating it as a utility was
            dead weight that only looked like it was doing something. */}
        <span className="pk-ico pk-ico--xl text-[var(--m)]">
          <QrIcon size={24} />
        </span>
        <p className="mt-3 text-[14px] font-bold">This build has no camera</p>
        <p className="pk-m mt-1.5 max-w-[34ch] leading-relaxed">
          Nothing here can read a QR code, so there is no viewfinder to show
          you. Pointing a phone at this screen would do nothing — the box below
          is the way in, and it does work.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <TextField
          label="Username or payment link"
          placeholder="@sarah or pocket:@sarah"
          hint="Type the username, or paste a link someone sent you."
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
            setPreview(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              resolve();
            }
          }}
        />

        <Button
          full
          size="lg"
          icon={<QrIcon size={16} />}
          disabled={text.trim().length === 0 || looking}
          onClick={resolve}
        >
          {looking ? "Looking it up…" : "Look it up"}
        </Button>
      </div>

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-2xl border border-[color-mix(in_srgb,var(--y)_28%,transparent)] bg-[color-mix(in_srgb,var(--y)_12%,transparent)] px-4 py-3 text-[12px] leading-relaxed text-[color-mix(in_srgb,var(--y)_42%,var(--t))]"
        >
          {error}
        </motion.p>
      ) : null}

      {preview ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pk-card mt-4"
        >
          <div className="flex items-center gap-3">
            <Avatar
              name={preview.recipient.name}
              src={preview.recipient.avatarUrl}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold">
                {preview.recipient.name}
              </p>
              <p className="pk-m truncate">
                {preview.recipient.handle} · verified
              </p>
            </div>
          </div>

          {preview.amountUnits !== undefined ? (
            <p className="pk-m mt-3 leading-relaxed">
              The link asks for{" "}
              <span className="font-semibold text-[var(--t)]">
                {formatMoney(preview.amountUnits)}
              </span>
              . It will be filled in on the next screen, where you can change
              it.
            </p>
          ) : (
            <p className="pk-m mt-3 leading-relaxed">
              The link names no amount, so you will set one next.
            </p>
          )}

          <Button
            full
            size="lg"
            className="mt-3"
            icon={<ChevronRightIcon size={16} />}
            onClick={() => onResolved(preview.recipient.id, preview.amountUnits)}
          >
            Continue to payment
          </Button>
        </motion.div>
      ) : null}

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="pk-m leading-relaxed">
          Being paid rather than paying? Your own code is on the receive
          screen.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={onOpenReceive}
        >
          Show my code
        </Button>
      </div>
    </div>
  );
}
