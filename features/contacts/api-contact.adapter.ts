/**
 * The real contact book.
 *
 * A `Contact` row holds an address and a label — no handle. So the mobile
 * add-contact flow, which collects a name and an `@handle`, has to resolve the
 * handle to an address before anything can be stored. That resolution is `GET
 * /api/users/handle`, the same lookup the sign-up screen uses.
 *
 * `lookup` is that resolution on its own, without the storing. The scan screen
 * needs to turn a typed or pasted handle into somewhere to send, and it must not
 * do that by saving a contact the user never asked to keep — a scanned person is
 * a destination for one payment, not an entry in somebody's address book. So the
 * lookup is exposed separately from `add`, and the caller decides whether to
 * keep the result.
 *
 * The consequence, stated rather than hidden: a handle that does not resolve
 * to a Pocket user cannot be added. Refusing beats filing an entry that can
 * never be paid. A contact added this way is verified by construction, because
 * its address came from the server.
 */

import { type AuthedFetch } from "@/lib/auth/client";
import type { Recipient } from "@/features/payments/payment.types";

/** A row of `GET /api/contacts`. */
type ContactRow = {
  id: string;
  ownerAddress: string;
  contactAddress: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

type HandleLookup = {
  handle: string;
  available: boolean;
  reason: string | null;
  address: string | null;
};

export type AddContactResult =
  | { ok: true; recipient: Recipient }
  | { ok: false; error: string };

/**
 * The answer to "who is `@someone`?", whether or not anybody is.
 *
 * The failure carries a sentence rather than a code because there is no screen
 * that wants to phrase it for itself: the two callers — scan and add-contact —
 * both put the server's words in front of the user unchanged.
 */
export type ResolveHandleResult =
  | { ok: true; recipient: Recipient }
  | { ok: false; error: string };

export interface ContactService {
  list(): Promise<Recipient[]>;
  add(name: string, handle: string): Promise<AddContactResult>;
  /** Resolve a handle to a person. Saves nothing — see the note above. */
  lookup(handle: string): Promise<ResolveHandleResult>;
}

function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toRecipient(row: ContactRow): Recipient {
  return {
    id: row.id,
    name: row.label,
    // There is no handle stored, so the address stands in for one. A truncated
    // address is the true thing to show: this entry is an address, not an
    // identity.
    handle: shorten(row.contactAddress),
    address: row.contactAddress,
    verified: true,
  };
}

export function createApiContactService(fetchAuthed: AuthedFetch): ContactService {
  return {
    async list(): Promise<Recipient[]> {
      const rows = await fetchAuthed<ContactRow[]>("/api/contacts");
      return rows.map(toRecipient);
    },

    async lookup(handle: string): Promise<ResolveHandleResult> {
      const lookup = await fetchAuthed<HandleLookup>(
        `/api/users/handle?handle=${encodeURIComponent(handle)}`,
      );

      if (lookup.address) {
        return {
          ok: true,
          recipient: {
            /*
              The lookup hands back a username and the address it pays to, and
              nothing else — no display name is published. So the address is the
              id (unique, stable, and already known to both sides) and the
              username is both the name and the handle. Making up a friendlier
              name here would be inventing a fact about a stranger.
            */
            id: lookup.address,
            name: `@${lookup.handle}`,
            handle: `@${lookup.handle}`,
            address: lookup.address,
            verified: true,
          },
        };
      }

      /*
        `reason` is set for a handle that is malformed or reserved — the route
        answers those offline. A well-formed handle nobody holds comes back
        `available: true` with no reason, which is not an error about the name
        but an absence of a person, and is worth saying differently.
      */
      return {
        ok: false,
        error: lookup.reason
          ? lookup.reason
          : `Nobody on Pocket holds ${handle} yet, so there is no address to pay.`,
      };
    },

    async add(name: string, handle: string): Promise<AddContactResult> {
      const label = name.trim();
      if (!label) return { ok: false, error: "Give this contact a name." };

      const lookup = await fetchAuthed<HandleLookup>(
        `/api/users/handle?handle=${encodeURIComponent(handle)}`,
      );

      if (lookup.address) {
        const row = await fetchAuthed<ContactRow>("/api/contacts", {
          method: "POST",
          body: JSON.stringify({ contactAddress: lookup.address, label }),
        });
        return { ok: true, recipient: toRecipient(row) };
      }

      /*
        Two different failures wear the same face here, and both are real:
        a malformed or reserved handle ("Pick a username."), and a well-formed
        one nobody holds ("That username is already taken." is the *taken*
        message; an unheld handle reports `available: true` and no address).
        The second case is the interesting one — the handle is fine, the person
        simply has no Pocket account, so there is no address to pay and nothing
        to save. Saying so is better than a row that fails at send time.
      */
      return {
        ok: false,
        error: lookup.reason
          ? lookup.reason
          : `Nobody on Pocket holds ${handle} yet, so there is no address to save.`,
      };
    },
  };
}
