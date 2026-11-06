"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { ChevronRightIcon, QrIcon } from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { parsePayLink } from "@/features/payments/paylink";
import type { ResolveHandleResult } from "@/features/contacts/api-contact.adapter";
import type { Recipient } from "@/features/payments/payment.types";
import { formatMoney } from "@/lib/formatters";
import { parseCheckoutLink } from "@/lib/requests/links";
import { hasNativeScanner, scanNativeQr } from "@/lib/native/client";
import type { AddressRecipientResult } from "@/features/payments/address-recipient";

/**
 * Android reads QR codes with the native camera. Manual entry remains available.
 * Codes use the existing checkout, directory and wallet-address validation paths;
 * the user still enters/reviews an amount and confirms before any signature.
 */
export function ScanScreen({
  onBack,
  onResolve,
  onResolved,
  onAddress,
  onOpenReceive,
}: {
  onBack: () => void;
  /** Resolve a handle to somebody payable. Async, and it can refuse. */
  onResolve: (handle: string) => Promise<ResolveHandleResult>;
  /** Hands a resolved destination, and any amount the link carried, to the transfer flow. */
  onResolved: (recipientId: string, amountUnits?: bigint) => void;
  /** Validates an address and opens the existing amount/review screen. Never signs. */
  onAddress?: (address: string) => AddressRecipientResult;
  onOpenReceive: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const nativeCamera = hasNativeScanner();
  const [preview, setPreview] = useState<{
    recipient: Recipient;
    amountUnits?: bigint;
  } | null>(null);

  async function resolve(input = text) {
    if (looking) return;
    setError(null);
    setPreview(null);

    if (input.trim().startsWith("0x") && onAddress) {
      const result = onAddress(input.trim());
      if (!result.ok) setError(result.error);
      return;
    }

    const checkout = parseCheckoutLink(input, window.location.origin);
    if (checkout) {
      window.location.assign(checkout);
      return;
    }

    const parsed = parsePayLink(input);
    if (!parsed) {
      setError(
        "Paste a Pocket payment link from this site, or enter a username such as @someone.",
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
      setPreview({
        recipient: result.recipient,
        amountUnits: parsed.amountUnits,
      });
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
        <p className="mt-3 text-[14px] font-bold">{nativeCamera ? "Scan a payment code" : "Paste a payment link"}</p>
        <p className="pk-m mt-1.5 max-w-[34ch] leading-relaxed">
          {nativeCamera ? "Open the camera and point it at a Pocket QR code. You’ll review the recipient and amount before paying." : "Enter a username or paste a Pocket payment link below."}
        </p>
        {nativeCamera ? <Button full className="mt-4" disabled={scanning || looking} onClick={async () => {
          setScanning(true);
          setError(null);
          try {
            const code = await scanNativeQr();
            if (code) { setText(code); await resolve(code); }
          } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not open the camera."); }
          finally { setScanning(false); }
        }}>{scanning ? "Camera open…" : "Open camera"}</Button> : null}
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
          onClick={() => void resolve()}
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
            onClick={() =>
              onResolved(preview.recipient.id, preview.amountUnits)
            }
          >
            Continue to payment
          </Button>
        </motion.div>
      ) : null}

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="pk-m leading-relaxed">
          Being paid rather than paying? Your own code is on the receive screen.
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
