/**
 * The real contact book.
 *
 * A `Contact` row holds an address and a label — no handle. So the mobile
 * add-contact flow, which collects a name and an `@handle`, has to resolve the
 * handle to an address before anything can be stored. That resolution is `GET
 * /api/users/handle`, the same lookup the sign-up screen uses.
 *
 * The consequence, stated rather than hidden: a handle that does not resolve
 * to a Pocket user cannot be added. The demo accepted any string and marked it
 * unverified; the real app would rather refuse than file an entry that can
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

export interface ContactService {
  list(): Promise<Recipient[]>;
  add(name: string, handle: string): Promise<AddContactResult>;
}

function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toRecipient(row: ContactRow): Recipient {
  return {
    id: row.id,
    name: row.label,
    // There is no handle stored, so the address stands in for one. Showing a
    // truncated address is a visible step down from the demo's `@sarah`, and
    // it is the true thing to show: this entry is an address, not an identity.
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
