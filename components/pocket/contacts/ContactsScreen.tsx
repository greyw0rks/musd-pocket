"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { ContactGrid } from "@/components/pocket/contacts/ContactGrid";
import { ChevronRightIcon, PlusIcon, QrIcon } from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { SearchField } from "@/components/pocket/ui/SearchField";
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
 * Adding a person creates an unverified entry, and the UI says so. Nothing in
 * this build resolves a handle to a payment address, so pretending a new
 * contact is payable would be the single most misleading thing this screen
 * could do.
 */
export function ContactsScreen({
  recipients,
  recent,
  user,
  onSelect,
  onAdd,
  onScan,
  onBack,
}: {
  recipients: Recipient[];
  recent: Recipient[];
  user: { name: string; handle: string; avatarUrl?: string };
  onSelect: (recipient: Recipient) => void;
  onAdd: (name: string, handle: string) => void;
  onScan: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recipients;
    return recipients.filter(
      (person) =>
        person.name.toLowerCase().includes(needle) ||
        person.handle.toLowerCase().includes(needle),
    );
  }, [recipients, query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const typed = handle.trim();
    const cleanHandle = typed.startsWith("@") ? typed : `@${typed}`;
    onAdd(cleanName, cleanHandle || "@unnamed");
    setName("");
    setHandle("");
    setAdding(false);
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
          subtitle="Added for this session only, and left unverified."
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
                Nothing in this demo resolves a handle to a payment address, so
                this person will be marked unverified.
              </p>

              <Button type="submit" full icon={<PlusIcon size={15} />}>
                Add without verifying
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
