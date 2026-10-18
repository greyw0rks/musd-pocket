"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  ChevronRightIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/pocket/icons";
import { SCREEN_PLAIN } from "@/components/pocket/theme";
import { NumberPad } from "@/components/pocket/transfer/NumberPad";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { TextArea } from "@/components/pocket/ui/TextField";
import {
  currentValue,
  expressionText,
  INITIAL_KEYPAD,
  pressBackspace,
  pressDecimal,
  pressDigit,
  pressOperator,
  type KeypadState,
  type Op,
} from "@/features/payments/amount";
import type { Recipient } from "@/features/payments/payment.types";
import {
  NOTE_MAX_LENGTH,
  type CreateRequestResult,
} from "@/features/requests/request.types";
import { formatMoney } from "@/lib/formatters";
import { shortenAddress } from "@/lib/utils";

/**
 * Ask someone for money.
 *
 * Deliberately the send screen's twin. A payment and a request are the same
 * two facts in the same two places — a person and a figure — so they are laid
 * out identically: the person in the header, the amount under it, the keypad
 * along the bottom. Learning one teaches the other, and a request never looks
 * like a form while a payment looks like a flow.
 *
 * The direction is the only difference, and it is carried by the words: the
 * header reads "Request from", the note says who is being asked, and the
 * submit control says what it does.
 *
 * The keypad used to live in a sheet. It does not any more — the sheet existed
 * because the old dark surface was the wrong place for a keypad, and the
 * keypad is now part of the same flat language as everything else, so hiding
 * it behind a tap was hiding the screen's main act.
 *
 * The amount is kept in this component's own keypad state rather than the
 * store's. The store's keypad belongs to the send flow; borrowing it would
 * mean starting a request wiped out a half-typed transfer.
 */
export function RequestScreen({
  contacts,
  initialCounterparty,
  title = "Request",
  subtitle = "Ask someone to pay you",
  notePlaceholder = "Design deposit, half up front",
  onCreate,
  onBack,
  onCreated,
  onSend,
}: {
  contacts: Recipient[];
  /** Who is being asked, when the screen was reached from a known person. */
  initialCounterparty?: Recipient | null;
  /**
   * Header copy. A merchant asking a customer to settle a bill and a person
   * asking a friend to split one are the same act with different words, so the
   * words are passed in rather than the composer being forked into two
   * screens that would drift apart on every subsequent change.
   */
  title?: string;
  subtitle?: string;
  notePlaceholder?: string;
  onCreate: (input: {
    counterparty: Recipient;
    amountUnits: bigint;
    note?: string;
  }) => Promise<CreateRequestResult>;
  onBack: () => void;
  onCreated: (requestId: string) => void;
  /**
   * Flip this person over to a payment instead. The mirror of the send
   * screen's ask control, and absent where there is nobody to send to yet.
   */
  onSend?: (person: Recipient) => void;
}) {
  const [counterparty, setCounterparty] = useState<Recipient | null>(
    initialCounterparty ?? null,
  );
  const [keypad, setKeypad] = useState<KeypadState>(INITIAL_KEYPAD);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountUnits = currentValue(keypad);
  const amountReady = amountUnits !== null && amountUnits > 0n;
  const canSubmit = Boolean(counterparty) && amountReady && !busy;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (person) =>
        person.name.toLowerCase().includes(needle) ||
        person.handle.toLowerCase().includes(needle),
    );
  }, [contacts, query]);

  async function submit() {
    if (!counterparty || !amountReady || busy) return;

    setBusy(true);
    setError(null);

    const result = await onCreate({
      counterparty,
      amountUnits: amountUnits ?? 0n,
      note: note.trim() || undefined,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.request.id);
  }

  const handle = counterparty
    ? shortenAddress(counterparty.address, 4) || counterparty.handle
    : subtitle;

  return (
    <div className={SCREEN_PLAIN}>
      <ScreenHeader
        title={
          counterparty
            ? `Request from ${counterparty.name.split(" ")[0]}`
            : title
        }
        subtitle={handle || undefined}
        onBack={onBack}
        action={
          onSend && counterparty ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 460, damping: 26 }}
              onClick={() => onSend(counterparty)}
              aria-label={`Send money to ${counterparty.name} instead`}
              title={`Send money to ${counterparty.name} instead`}
              className="pk-chip outline-none"
            >
              Send
            </motion.button>
          ) : undefined
        }
      />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-center gap-2">
          <span className="pk-amt">${expressionText(keypad) || "0"}</span>
          {counterparty ? (
            <Avatar
              name={counterparty.name}
              src={counterparty.avatarUrl}
              size={26}
              className="shrink-0 translate-y-[5px]"
            />
          ) : null}
        </div>

        <p className="pk-m mb-3 text-center tabular-nums">
          {amountReady
            ? `They will be asked for ${formatMoney(amountUnits ?? 0n)}`
            : "Enter an amount greater than zero"}
        </p>

        {/*
          Who is paying. The reference puts a bare text input here; a list of
          people you have already paid is a better answer than a free-text
          handle, so this opens the same picker the send flow uses.
        */}
        <ListGroup>
          <ListRow
            leading={
              counterparty ? (
                <Avatar
                  name={counterparty.name}
                  src={counterparty.avatarUrl}
                  size={40}
                />
              ) : (
                <span className="pk-ico">
                  <UsersIcon size={18} />
                </span>
              )
            }
            title={counterparty?.name ?? "Choose someone"}
            subtitle={counterparty?.handle ?? "Who is paying?"}
            onPress={() => setPicking(true)}
            trailing={
              <ChevronRightIcon size={18} className="text-[var(--m)]" />
            }
          />
        </ListGroup>

        <TextArea
          className="mt-3"
          label="What is it for?"
          hint={`${note.length}/${NOTE_MAX_LENGTH} — optional, but the reason a request gets paid.`}
          maxLength={NOTE_MAX_LENGTH}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={notePlaceholder}
        />

        {error ? (
          <p className="mt-1 px-1 text-[11px] font-semibold text-[var(--r-ink)]">
            {error}
          </p>
        ) : null}

        <div className="mt-auto pt-4">
          <Button
            full
            disabled={!canSubmit}
            loading={busy}
            onClick={() => void submit()}
          >
            {busy ? "Sending request" : "Send request"}
          </Button>

          <p className="pk-m mt-2 text-center">
            Nothing moves. This opens a request they can pay or turn down, and
            it expires on its own after a week.
          </p>

          <div className="mt-3">
            <NumberPad
              onDigit={(digit) => setKeypad((state) => pressDigit(state, digit))}
              onDecimal={() => setKeypad(pressDecimal)}
              onOperator={(op: Op) =>
                setKeypad((state) => pressOperator(state, op))
              }
              onBackspace={() => setKeypad(pressBackspace)}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- picker */}
      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Who is paying?"
      >
        <div className="flex items-center gap-2 rounded-full bg-[var(--s2)] px-4 py-2.5">
          <SearchIcon size={16} className="shrink-0 text-[var(--m)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contacts"
            aria-label="Search contacts"
            type="search"
            className="w-full bg-transparent text-[13px] font-medium text-[var(--t)] outline-none placeholder:text-[var(--m)] [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>

        <div className="pocket-scroll mt-2 max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="pk-m px-1 py-6 text-center">
              Nobody matches “{query}”.
            </p>
          ) : (
            matches.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  setCounterparty(person);
                  setPicking(false);
                  setQuery("");
                }}
                className="pk-li w-full text-left outline-none"
              >
                <Avatar name={person.name} src={person.avatarUrl} size={40} />
                <span className="pk-f">
                  <b className="truncate text-[14px]">{person.name}</b>
                  <span className="pk-m mt-0.5 block truncate">
                    {person.handle}
                  </span>
                </span>
                {person.id === counterparty?.id ? (
                  <span className="pk-pill pk-pill--info">Selected</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </Sheet>
    </div>
  );
}
