"use client";

import { useState } from "react";
import { MailIcon } from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { TextField } from "@/components/pocket/ui/TextField";
import { RECEIPTS_CHANNEL_LABEL } from "@/features/session/session.types";

/**
 * Connect or drop the address a receipt copy goes to.
 *
 * This is where Google lives. It is not a sign-in method — signing in with X
 * gives a name and a subject and no address, so a mailbox has to be connected
 * separately, for delivery. Keeping it a separate decision is also what makes
 * it revocable: an identity you cannot sign out of is a trap, and a delivery
 * address you cannot remove is the same trap wearing a smaller hat.
 *
 * Nothing is emailed, and `setReceipts` stores nothing — there is no
 * receipt-address column on the server — so the sheet says so rather than
 * letting a connected-looking row imply otherwise.
 *
 * It lives in its own module because both a personal Profile and a merchant's
 * Business settings open it. The delivery address is the same fact about the
 * same account either way, and two copies of this panel would be two places
 * for the "nothing is emailed yet" sentence to go missing from.
 */
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
  const [busy, setBusy] = useState<"google" | "email" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(channel: "google" | "email", value: string) {
    if (busy) return;
    setError(null);

    // The only validation worth doing here: an address that cannot receive
    // anything is not a receipt channel. A stricter pattern would reject real
    // addresses, so it checks the shape people agree on and stops.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      setError("That does not look like an email address.");
      return;
    }

    setBusy(channel);
    await setReceipts({ channel, address: value.trim() });
    setBusy(null);
    setAddress("");
    onClose();
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    await setReceipts(null);
    setBusy(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Receipts">
      <p className="pk-m text-center leading-relaxed">
        Where a copy of each payment goes. Signing in with X does not share an
        address, so this is connected separately and can be removed again.
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

      <div className="mt-5 space-y-2">
        <Button
          full
          size="lg"
          loading={busy === "google"}
          disabled={busy !== null}
          icon={<MailIcon size={15} />}
          onClick={() => void connect("google", "alex.morgan@gmail.com")}
        >
          Connect Google
        </Button>

        {current ? (
          <Button
            full
            size="lg"
            variant="danger"
            loading={busy === "remove"}
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-5">
        <TextField
          label="Or use another address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={address}
          error={error ?? undefined}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void connect("email", address);
          }}
        />
        <Button
          full
          size="lg"
          variant="secondary"
          className="mt-1"
          loading={busy === "email"}
          disabled={busy !== null || address.trim().length === 0}
          onClick={() => void connect("email", address)}
        >
          Use this address
        </Button>
      </div>

      <p className="pk-m mt-5 leading-relaxed">
        Receipt copies are not sent yet, and there is nowhere on the server to
        keep this address — connecting it will not stay. The panel is here so
        the shape is ready when delivery is.
      </p>
    </Sheet>
  );
}
