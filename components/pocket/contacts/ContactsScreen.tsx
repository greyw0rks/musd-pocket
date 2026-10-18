"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { ContactGrid } from "@/components/pocket/contacts/ContactGrid";
import { ChevronRightIcon, LinkIcon, PlusIcon, QrIcon } from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { SearchField } from "@/components/pocket/ui/SearchField";
import type { AddressRecipientResult } from "@/features/payments/address-recipient";
import type { Recipient } from "@/features/payments/payment.types";

/**
 * Contacts — the first half of Send.
 *
 * This is a pushed screen, so it wears the same padded column, the same header
 * and the same cards as every other pushed screen: a back disc in the top-left,
 * a search field, faces, and two quiet lists underneath. The previous pass had
 * it as a grid floating over a white sheet that ignored the theme entirely,
 * which is the one thing this screen could not keep — a person picking a
 * recipient in light mode was looking at a dark screen with a white card
 * stapled to the bottom of it.
 *
 * The two lists that used to hide behind an "All / My accounts" switch are both
 * shown instead. The switch was a control that could only ever hide half of
 * four rows, and a labelled group says which half you are reading without being
 * asked first.
 *
 * Adding a person is a *lookup*: the server resolves the username to an
 * address and either stores the row or refuses, because a handle nobody holds
 * has nothing to save. The form says that and stays open while it happens.
 *
 * Below it is the third way in and the only one that asks nobody anything —
 * sending to a `0x` address the user typed. It is a real destination (mUSD is
 * an ERC-20; an address is all a transfer needs) and it is deliberately not an
 * addition to the address book: the address is held for the one payment, the
 * way a scanned handle is. See `features/payments/address-recipient.ts` for
 * what is and is not checked about it.
 */
export function ContactsScreen({
  recipients,
  recent,
  user,
  onSelect,
  onAdd,
  onPayAddress,
  onScan,
  onBack,
}: {
  recipients: Recipient[];
  recent: Recipient[];
  user: { name: string; handle: string; avatarUrl?: string };
  onSelect: (recipient: Recipient) => void;
  /** Resolves the handle to an address and saves the contact, or explains why not. */
  onAdd: (name: string, handle: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Sends to an address the user typed, without saving anybody.
   *
   * Synchronous, and it navigates on success — the store has already moved to
   * the transfer screen by the time it returns `ok`, so this screen does not
   * close anything or reset its own form afterwards.
   */
  onPayAddress: (address: string) => AddressRecipientResult;
  onScan: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [address, setAddress] = useState("");
  const [addressProblem, setAddressProblem] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recipients;
    return recipients.filter(
      (person) =>
        person.name.toLowerCase().includes(needle) ||
        person.handle.toLowerCase().includes(needle),
    );
  }, [recipients, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || saving) return;

    const typed = handle.trim();
    setSaving(true);
    setProblem(null);

    /*
      The form stays open until the answer comes back.

      Adding a contact is a lookup now, and a lookup can fail — a username
      nobody holds has no address, so there is nothing to save. Closing the
      form on submit would have discarded what the user typed at the exact
      moment they need it to try a different handle.
    */
    const result = await onAdd(cleanName, typed ? `@${typed.replace(/^@+/, "")}` : "");
    setSaving(false);

    if (!result.ok) {
      setProblem(result.error ?? "Could not add that contact.");
      return;
    }

    setName("");
    setHandle("");
    setAdding(false);
  }

  /**
   * The address route in.
   *
   * No `saving` flag and no `await`: there is no round-trip to wait for. An
   * address is checked for its own internal consistency and nothing else, and
   * on success the store has already pushed the transfer screen — so the only
   * outcome this function handles is the refusal, which keeps the form open
   * with the text the user typed still in it.
   */
  function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    setAddressProblem(null);

    const result = onPayAddress(address);
    if (!result.ok) setAddressProblem(result.error);
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Send to"
        subtitle="Pick who the money goes to"
        onBack={onBack}
        action={
          /*
            Paying someone from a link is a contacts-shaped task, so the way
            in sits here rather than behind a camera nobody has. It takes the
            header's trailing slot rather than a floating disc, because a
            control hovering over the list is a control that covers a face.
          */
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            onClick={onScan}
            aria-label="Pay a username or link"
            title="Pay a username or link"
            className="pk-ib outline-none"
          >
            <QrIcon size={20} />
          </motion.button>
        }
      />

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search contacts"
      />

      {filtered.length > 0 ? (
        <ContactGrid recipients={filtered} onSelect={onSelect} />
      ) : (
        <p className="pk-m py-10 text-center">
          Nobody matches &ldquo;{query}&rdquo;.
        </p>
      )}

      <ListGroup label="Add someone" className="mt-2">
        <ListRow
          leading={
            <span className="pk-ico">
              <PlusIcon size={18} />
            </span>
          }
          title="New contact"
          /*
            Says what actually happens, which the previous wording did not: it
            claimed a session-only entry, from the build where the contact book
            was local. `addContact` now resolves the handle against the
            directory and the server stores the row, so "saved" is the fact and
            "this session only" was the opposite of it.
          */
          subtitle="Saved to your contacts, once the username resolves to an address."
          onPress={() => setAdding((open) => !open)}
          trailing={
            <motion.span
              animate={{ rotate: adding ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="grid place-items-center text-[var(--m)]"
            >
              <ChevronRightIcon size={16} />
            </motion.span>
          }
        />
      </ListGroup>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.form
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pk-card mt-2 space-y-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                aria-label="New recipient name"
                className="pk-in"
              />
              <input
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@handle"
                aria-label="New recipient handle"
                className="pk-in"
              />

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "color-mix(in srgb, var(--y) 42%, var(--t))" }}
              >
                {problem ??
                  "Pocket looks the username up and saves the address it resolves to. A name nobody holds cannot be saved, because there would be nothing to pay."}
              </p>

              <Button
                type="submit"
                full
                icon={<PlusIcon size={15} />}
                disabled={saving}
              >
                {saving ? "Looking up…" : "Add contact"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/*
        The third way in, and the only one that needs nobody's permission.

        A saved contact and a scanned handle both end at a server lookup that
        turns a name into an address. This starts with the address, so there is
        nothing to look up — and it is a real destination all the same, because
        mUSD is an ERC-20 and an address is the whole of what a transfer needs.

        It sits in its own group rather than under "Add someone" because the
        difference the group label draws is the one that matters: this saves
        nobody. What the user typed is held for the single payment, exactly as
        a scanned handle is, and their contact list is not quietly changed by a
        payment they were only passing through.
      */}
      <ListGroup label="Or send to an address" className="mt-2">
        <ListRow
          leading={
            <span className="pk-ico">
              <LinkIcon size={18} />
            </span>
          }
          title="Wallet address"
          subtitle="Paste a 0x address. Nothing is saved — it is used for this payment only."
          onPress={() => {
            setAddressProblem(null);
            setPaying((open) => !open);
          }}
          trailing={
            <motion.span
              animate={{ rotate: paying ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="grid place-items-center text-[var(--m)]"
            >
              <ChevronRightIcon size={16} />
            </motion.span>
          }
        />
      </ListGroup>

      <AnimatePresence initial={false}>
        {paying && (
          <motion.form
            onSubmit={submitAddress}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pk-card mt-2 space-y-2">
              <input
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setAddressProblem(null);
                }}
                placeholder="0x…"
                aria-label="Recipient wallet address"
                /*
                  `spellCheck` off because a 40-character hex string is not
                  prose and every red underline under it is noise; the
                  monospace face is so a `0` and an `O` are distinguishable,
                  which for an address is the difference between arriving and
                  not.
                */
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="none"
                className="pk-in font-mono"
              />

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "color-mix(in srgb, var(--y) 42%, var(--t))" }}
              >
                {addressProblem ??
                  "Check it against wherever you copied it from. A transfer to the wrong address confirms like any other, and nothing here can call it back."}
              </p>

              <Button
                type="submit"
                full
                icon={<LinkIcon size={15} />}
                disabled={address.trim().length === 0}
              >
                Continue
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <ListGroup label="Recent">
        {recent.length > 0 ? (
          recent.map((person) => (
            <ListRow
              key={person.id}
              leading={<Avatar name={person.name} src={person.avatarUrl} size={40} />}
              title={person.name}
              trailing={<span className="pk-m">{person.handle}</span>}
              onPress={() => onSelect(person)}
            />
          ))
        ) : (
          <div className="pk-li pk-li--static">
            <span className="pk-f">
              <span className="pk-m">No one sent yet.</span>
            </span>
          </div>
        )}
      </ListGroup>

      <ListGroup label="My accounts">
        <ListRow
          as="div"
          leading={<Avatar name={user.name} src={user.avatarUrl} size={40} />}
          title={user.name}
          subtitle={user.handle}
          trailing={<span className="pk-pill">MUSD wallet</span>}
        />
      </ListGroup>
    </div>
  );
}
