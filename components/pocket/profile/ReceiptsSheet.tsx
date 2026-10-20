"use client";

import { useState } from "react";
import { usePocket } from "@/components/pocket/store";
import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { TextField } from "@/components/pocket/ui/TextField";
import { RECEIPTS_CHANNEL_LABEL } from "@/features/session/session.types";

/**
 * Connect or drop the address a receipt copy goes to.
 *
 * Signing in with X gives a name and a subject and no address, so a mailbox is
 * connected separately. Keeping it a separate decision is what makes it
 * revocable: an identity you cannot sign out of is a trap, and a delivery
 * address you cannot remove is the same trap wearing a smaller hat.
 *
 * The server stores the address on the user row and reads it back with the
 * session, so this panel shows what is actually saved. A receipt is only ever
 * sent to an address the user attached here.
 *
 * It lives in its own module because both a personal Profile and a merchant's
 * Business settings open it. The delivery address is the same fact about the
 * same account either way, and two copies of this panel would be two places for
 * the "where receipts go" sentence to go missing from.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ReceiptsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { session, setReceipts } = usePocket();
  const current = session?.user.receipts;

  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<"email" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(value: string) {
    if (busy) return;
    setError(null);

    // The only validation worth doing here: an address that cannot receive
    // anything is not a receipt channel. A stricter pattern would reject real
    // addresses, so it checks the shape people agree on and stops.
    const trimmed = value.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("That does not look like an email address.");
      return;
    }

    setBusy("email");
    try {
      await setReceipts({ channel: "email", address: trimmed });
      setAddress("");
      onClose();
    } catch {
      setError("Could not save that address. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setError(null);
    setBusy("remove");
    try {
      await setReceipts(null);
      onClose();
    } catch {
      setError("Could not remove it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Receipts">
      <p className="pk-m text-center leading-relaxed">
        Where a copy of each confirmed payment, withdrawal and loan goes.
        Signing in with X does not share an address, so it is added separately
        and can be removed again.
      </p>

      {current ? (
        <div className="pk-card mt-5 !py-3.5">
          <p className="pk-m font-semibold">
            Connected · {RECEIPTS_CHANNEL_LABEL[current.channel]}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-semibold">
            {current.address}
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <TextField
          label={current ? "Replace with another address" : "Your email address"}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={address}
          error={error ?? undefined}
          onChange={(event) => {
            setAddress(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void connect(address);
          }}
        />
        <Button
          full
          size="lg"
          variant="secondary"
          className="mt-1"
          loading={busy === "email"}
          disabled={busy !== null || address.trim().length === 0}
          onClick={() => void connect(address)}
        >
          Save address
        </Button>

        {current ? (
          <Button
            full
            size="lg"
            variant="danger"
            className="mt-2"
            loading={busy === "remove"}
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <p className="pk-m mt-5 leading-relaxed">
        A receipt is emailed after a payment, withdrawal or loan is confirmed
        on-chain. Remove the address and nothing is sent.
      </p>
    </Sheet>
  );
}
