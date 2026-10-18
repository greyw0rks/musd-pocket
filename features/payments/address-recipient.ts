import { getAddress, isAddress } from "viem";
import type { Recipient } from "@/features/payments/payment.types";

/**
 * Somewhere to send, given as a raw wallet address.
 *
 * Every other destination in this app arrives as an *identity*: a handle that
 * the server resolved to an address, or a contact the user saved after such a
 * resolution. Both routes end the same way — a `Recipient` carrying an address
 * that something else vouched for.
 *
 * This is the route where nothing vouches. The user typed an address, or
 * pasted one from somewhere the app cannot see, and that is the whole of what
 * is known about the destination. It is still a legitimate destination: mUSD
 * is an ERC-20 and an address is the only thing a transfer actually needs. The
 * server has always accepted one — `Payment.recipientAddress` exists for
 * exactly this case, `app/api/payments/record/route.ts` files the row against
 * the address when no Pocket user holds it, and the activity reader already
 * prints a raw address as a counterparty. What was missing was a way in.
 *
 * ## Why the checksum is checked
 *
 * `isAddress` rejects a mixed-case address whose EIP-55 checksum does not add
 * up, which is the one class of typo that is *detectable* in an address: the
 * capitalisation encodes a checksum, so a single transposed or mistyped
 * character makes the letters disagree with it. An all-lowercase address
 * carries no checksum and is accepted as typed, because there is nothing in it
 * to contradict.
 *
 * That check is the reason this module exists rather than four lines in a
 * component. The alternative — letting a malformed address through to the
 * transfer screen — surfaces later as the payment service's "That contact has
 * no address to pay yet", which is a sentence about contacts and would be
 * shown to somebody who never mentioned one.
 *
 * ## The label
 *
 * `name` and `handle` are both the shortened address, deliberately: the
 * transfer screen heads itself "Send to {name}" and prints the address again
 * underneath, so the destination of an irreversible transfer is on screen
 * twice rather than once. It is shortened in the same shape the activity feed
 * uses (`0x82ab…91A4`) so the same address is not written two different ways
 * on two screens describing one payment.
 *
 * ## Why `verified` is true
 *
 * The flag is read as "this destination can be paid" — by `confirmSend`, by
 * `ContactGrid`, and by the payment service's own address check. Here it means
 * what it means everywhere: there is a real address behind this recipient.
 * What it does *not* mean is that a person was confirmed to own it, which is
 * why an address recipient is never written into `contacts`. It is held for
 * the one payment, like a scanned handle (see `directory` in the store), and
 * the contact book does not grow by it.
 */

/**
 * `0x82ab…91A4`.
 *
 * Written here rather than imported from `lib/utils`'s `shortenAddress`, which
 * truncates to a different number of characters. This reproduces the shape the
 * activity feed prints for an address-only payment, so one address reads the
 * same way on the transfer screen and on the receipt for the transfer it made.
 */
function label(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type AddressRecipientResult =
  | { ok: true; recipient: Recipient }
  | { ok: false; error: string };

/**
 * Turn a typed address into somebody payable, or say why it cannot be.
 *
 * Pure and synchronous — there is nothing to ask a server. The answer is the
 * user's own input and the checksum inside it.
 */
export function addressRecipient(raw: string): AddressRecipientResult {
  const typed = raw.trim();

  if (!typed) {
    return { ok: false, error: "Enter the wallet address to send to." };
  }

  if (!isAddress(typed)) {
    return {
      ok: false,
      error:
        "That is not a wallet address. It should start with 0x and be followed by 40 letters or digits.",
    };
  }

  /*
    `getAddress` throws only when a mixed-case address fails its own checksum,
    which `isAddress` has already ruled out — so this cannot throw in practice.
    It stays because the alternative is a bare call whose failure mode is an
    exception in a component, and a checksum is exactly the thing that should
    never be trusted to "cannot happen".
  */
  let checksummed: string;
  try {
    checksummed = getAddress(typed);
  } catch {
    return {
      ok: false,
      error:
        "That address has a typing error in its capital letters. Paste it again rather than retyping it.",
    };
  }

  const shown = label(checksummed);

  return {
    ok: true,
    recipient: {
      /*
        Prefixed, so an address recipient can never be mistaken for a saved
        contact (those are cuids) or for a session-only resolved person.
      */
      id: `address:${checksummed.toLowerCase()}`,
      name: shown,
      handle: shown,
      address: checksummed,
      verified: true,
    },
  };
}
