"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  clearKeypad,
  currentValue,
  pressBackspace,
  pressDecimal,
  pressDigit,
  pressOperator,
  unitsToDecimal,
  INITIAL_KEYPAD,
  type KeypadState,
  type Op,
} from "@/features/payments/amount";
import type { PaymentService, Recipient, Transaction } from "@/features/payments/payment.types";
import type { PocketNotification } from "@/features/notifications/notification.types";
import type {
  CreateRequestInput,
  CreateRequestResult,
  PaymentRequest,
  RequestCapabilities,
  RequestService,
  SettleRequestResult,
} from "@/features/requests/request.types";
import type {
  AuthProvider,
  ProfileUpdate,
  ReceiptsLink,
  Session,
  SessionService,
} from "@/features/session/session.types";
import type {
  AddContactResult,
  ContactService,
  ResolveHandleResult,
} from "@/features/contacts/api-contact.adapter";
import type { AddressRecipientResult } from "@/features/payments/address-recipient";
import { addressRecipient } from "@/features/payments/address-recipient";
import { ApiError } from "@/lib/auth/client";
import type {
  ScreenId,
  ScreenParams,
  StackEntry,
} from "@/components/pocket/navigation/ids";

export type { ScreenId, ScreenParams, StackEntry };

/** The transfer screen's two states. Idle while the user is still choosing. */
export type TransferPhase = "idle" | "sending";

interface PocketStore {
  /** False until the session and the ledger have both been read once. */
  ready: boolean;

  session: Session | null;
  /**
   * The wallet's mUSD, in minor units — the app's one balance.
   *
   * `null` means "not read yet", not zero. The distinction is the whole reason
   * this is nullable: the figure comes from a chain read that takes a moment,
   * and a `0n` seed would paint `$0.00` over money the user actually holds.
   * Screens withhold the number instead of printing one.
   */
  balance: bigint | null;
  transactions: Transaction[];
  contacts: Recipient[];
  highlightId: string | null;

  /* Notifications */
  notifications: PocketNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  /* Requests */
  requests: PaymentRequest[];
  requestsLoading: boolean;
  createRequest: (input: CreateRequestInput) => Promise<CreateRequestResult>;
  /** Pays an incoming request through the payment service. Never moves money itself. */
  payRequest: (id: string) => Promise<SettleRequestResult>;
  declineRequest: (id: string) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  /**
   * Which request actions the injected service can perform.
   *
   * Passed straight through from the adapter, because the screens ask before
   * they draw a control — a "Withdraw request" button that always errors is a
   * worse answer than no button. See `RequestCapabilities`.
   */
  requestCapabilities: RequestCapabilities;
  requestById: (id: string | undefined) => PaymentRequest | null;

  /* Navigation */
  stack: StackEntry[];
  current: StackEntry;
  canGoBack: boolean;
  push: (id: ScreenId, params?: ScreenParams) => void;
  replace: (id: ScreenId, params?: ScreenParams) => void;
  back: () => void;
  /** Clears the whole stack. Used when leaving onboarding or signing out. */
  reset: (id: ScreenId, params?: ScreenParams) => void;

  /* Onboarding */
  signIn: (provider: AuthProvider, email?: string) => Promise<string | null>;
  saveProfile: (update: ProfileUpdate) => Promise<string | null>;
  checkHandle: (handle: string) => Promise<string | null>;
  setReceipts: (link: ReceiptsLink | null) => Promise<void>;
  signOut: () => Promise<void>;

  /* The send flow, owned in one place so it cannot drift across screens */
  keypad: KeypadState;
  amountUnits: bigint | null;
  phase: TransferPhase;
  error: string | null;
  /** Bumped to tell the swipe control to spring back to the start. */
  resetSignal: number;
  pressDigitKey: (digit: string) => void;
  pressDecimalKey: () => void;
  pressOperatorKey: (op: Op) => void;
  pressBackspaceKey: () => void;
  startSend: () => void;
  chooseRecipient: (recipientId: string, amountUnits?: bigint) => void;
  confirmSend: () => Promise<void>;

  /* People */
  /**
   * Add somebody to the contact book.
   *
   * Async and fallible, because it is a network round-trip that can refuse: a
   * handle nobody holds has no address to save, and saying so is better than
   * filing an entry that can never be paid.
   */
  addContact: (name: string, handle: string) => Promise<AddContactResult>;
  /**
   * Turn a handle into somebody payable, without saving anybody.
   *
   * The scan screen's whole job, and a different one from `addContact`: it
   * resolves a destination for a single payment rather than keeping a person.
   * What it finds is held for the send (see `directory`) so the transfer screen
   * can look them up by id, but the contact book does not grow by it.
   */
  resolveHandle: (handle: string) => Promise<ResolveHandleResult>;
  /**
   * Find people in the Pocket directory as a handle is typed.
   *
   * The contact book only knows who the user saved; the directory knows who
   * exists. Results are already payable — each carries the address the server
   * resolved — so a hit can go straight to the transfer screen without first
   * becoming a contact.
   *
   * Async and fallible: network failure is the caller's to absorb, because a
   * search field should keep showing saved contacts when the directory cannot
   * be reached.
   */
  searchDirectory: (query: string) => Promise<Recipient[]>;
  /**
   * Choose somebody from any list — saved, searched or scanned.
   *
   * A searched person is not a saved contact, so they are remembered in
   * `directory` for this send only, exactly where a scanned handle lands.
   * `recipientById` reads contacts first, so this never shadows a saved entry.
   */
  choosePerson: (recipient: Recipient) => void;
  /**
   * Send to an address the user typed, rather than to a person.
   *
   * The third way into the transfer screen, after a saved contact and a scanned
   * handle — and the only one where no server is asked anything, because an
   * address needs no resolution. It is synchronous for that reason.
   *
   * Like a scanned handle and unlike a saved contact, this registers nobody:
   * the address is held for the one payment (`directory`) and the contact book
   * does not grow by it.
   */
  payAddress: (address: string) => AddressRecipientResult;
  recipientById: (id: string | undefined) => Recipient | null;
}

const Ctx = createContext<PocketStore | null>(null);

export function usePocket(): PocketStore {
  const store = useContext(Ctx);
  if (!store) {
    throw new Error("usePocket must be used inside <PocketProvider>.");
  }
  return store;
}

let keyCounter = 0;
function entry(id: ScreenId, params: ScreenParams = {}): StackEntry {
  keyCounter += 1;
  return { id, params, key: `${id}:${keyCounter}` };
}

/** The three most recently paid people, for the picker's shortcut list. */
function recentRecipients(
  transactions: Transaction[],
  contacts: Recipient[],
): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];

  for (const tx of transactions) {
    if (seen.has(tx.recipientId)) continue;
    seen.add(tx.recipientId);

    const match = contacts.find((person) => person.id === tx.recipientId);
    if (match) out.push(match);
    if (out.length === 3) break;
  }

  return out;
}

/**
 * What the app talks to.
 *
 * Every field is required. There is no fallback set of implementations behind
 * this interface and no in-memory substitute for any of them: the app either
 * has a real service to call or it does not run. That is deliberate — a build
 * that could quietly substitute fixtures for the money paths was a second app
 * living inside this one, and the two drifted.
 */
export interface PocketServices {
  payments: PaymentService;
  sessions: SessionService;
  requests: RequestService;
  /** `/api/contacts` — there is no local contact book to fall back on. */
  contacts: ContactService;
  /**
   * The session the shell already resolved, used as the starting value.
   *
   * `SessionProvider` has authenticated and read `/api/users/me` before this
   * app mounts, so the identity is known. Starting from `null` would mean a
   * failed re-read drops a signed-in user onto the sign-in screen, which is
   * both wrong and unrecoverable, since that screen cannot sign anyone in.
   */
  initialSession?: Session | null;
}

export function PocketProvider({
  children,
  services,
}: {
  children: ReactNode;
  services: PocketServices;
}) {
  /**
   * The contact list as the request service sees it.
   *
   * The service is built once, at boot, while the people a user can ask for
   * money change as they add contacts. A resolver closing over a snapshot would
   * make every contact added after the first render invisible to requests —
   * so it reads through a ref and always sees the current list.
   */
  const contactsRef = useRef<Recipient[]>([]);

  /*
    Held in a ref for the lifetime of the mount.

    The provider is handed a freshly-built service set once, and every hook
    below closes over it. Reading it through state would let a re-render swap
    the services underneath a `useCallback` that had already captured them.
  */
  const resolved = useRef<PocketServices>(services).current;
  const { payments, sessions, requests: requestService } = resolved;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(
    resolved.initialSession ?? null,
  );
  /*
    Nothing until the chain answers.

    `null` is "not read yet", and it is the starting state rather than a `0n`
    seed: a zero painted here would be a number the app invented about money
    the user actually holds. The boot read below fills it in.
  */
  const [balance, setBalance] = useState<bigint | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contacts, setContacts] = useState<Recipient[]>([]);
  /*
    People resolved during this session but never saved.

    A scanned handle and a saved contact are different things: one is a lookup
    against the directory, the other a row the user chose to keep. Holding the
    resolved person here — rather than pushing them into `contacts` — keeps the
    contact grid honest about what was actually saved, while still letting the
    transfer screen find them by id.
  */
  const [directory, setDirectory] = useState<Recipient[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /*
    Starts empty, and stays empty until a send puts something in it.

    There is no notification backend, so nothing can arrive from elsewhere — a
    seeded list would be the app inventing events. See `announce`.
  */
  const [notificationLog, setNotificationLog] = useState<PocketNotification[]>(
    [],
  );

  const [requestLog, setRequestLog] = useState<PaymentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [stack, setStack] = useState<StackEntry[]>(() => [entry("welcome")]);

  const [keypad, setKeypad] = useState<KeypadState>(INITIAL_KEYPAD);
  const [phase, setPhase] = useState<TransferPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  /**
   * The authoritative duplicate-send guard.
   *
   * A ref, not state: two taps landing in the same tick would both read a
   * stale `phase` and both send. Sending moves real money, so this is the one
   * place that does not wait for a render.
   */
  const inFlight = useRef(false);

  /* ---------------------------------------------------------------- boot */

  useEffect(() => {
    let cancelled = false;

    /*
      Every read is individually fallible, and a failure must not be fatal.

      Every read here goes over a network, and any of them can fail. A
      `Promise.all` would make one dropped request — the contact list, say —
      leave `ready` false forever, which is a splash screen that never
      resolves. Each read therefore falls back to the last known value and
      reports itself, and the app opens either way.

      The fallbacks are the *previous* state rather than empty values, so a
      transient failure does not blank a balance the user just saw.
    */
    const failed: string[] = [];
    const read = <T,>(label: string, work: Promise<T>, fallback: T): Promise<T> =>
      work.catch((e) => {
        failed.push(`${label}: ${e instanceof Error ? e.message : "failed"}`);
        return fallback;
      });

    void (async () => {
      const [existing, nextBalance, nextTransactions, nextRequests, nextContacts] =
        await Promise.all([
          read("session", sessions.getSession(), session),
          read("balance", payments.getBalance(), balance),
          read("transactions", payments.listTransactions(), transactions),
          read("requests", requestService.list(), requestLog),
          read("contacts", resolved.contacts.list(), contacts),
        ]);
      if (cancelled) return;

      if (failed.length > 0) {
        // Reported, not swallowed. The screens still render whatever they
        // have, so a partial boot is visible as a gap rather than as an error
        // page — but it is never silent.
        console.error("[pocket] boot read failed", failed);
      }

      setSession(existing);
      setBalance(nextBalance);
      setTransactions(nextTransactions);
      setRequestLog(nextRequests);
      setContacts(nextContacts);
      setRequestsLoading(false);

      /*
        Where to land depends on how far the last visit got. A signed-in user
        with a username finished onboarding; one without it was interrupted
        between the account-type and profile screens, and dropping them on Home
        would leave them with a half-built profile.

        The first branch is unreachable in practice: the shell signs the user in
        before this app is mounted, and the adapter only returns null when the
        token itself was rejected.
      */
      if (!existing) {
        setStack([entry("welcome")]);
      } else if (!existing.user.handle) {
        setStack([entry("account-type")]);
      } else {
        setStack([entry("home")]);
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately boot-only: this reads the world once when the app opens.
    // Re-running it on every state change would re-fetch the ledger on each
    // keystroke anywhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, payments, requestService, resolved.contacts]);

  // Keeps the request service's view of people current without rebuilding it.
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  // Let the highlight fade on its own.
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timer);
  }, [highlightId]);

  /* ------------------------------------------------------------ navigate */

  const push = useCallback((id: ScreenId, params: ScreenParams = {}) => {
    setStack((current) => [...current, entry(id, params)]);
  }, []);

  const replace = useCallback((id: ScreenId, params: ScreenParams = {}) => {
    setStack((current) => [...current.slice(0, -1), entry(id, params)]);
  }, []);

  const back = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback((id: ScreenId, params: ScreenParams = {}) => {
    setStack([entry(id, params)]);
  }, []);

  const current = stack[stack.length - 1];

  /* --------------------------------------------------------------- money */

  /**
   * Re-read the balance and ledger from the service.
   *
   * The UI is never allowed to be the source of truth about money — that habit
   * is what produces the bugs this plan exists to avoid.
   */
  const refresh = useCallback(async () => {
    const [nextBalance, nextTransactions] = await Promise.all([
      payments.getBalance(),
      payments.listTransactions(),
    ]);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
  }, [payments]);

  /**
   * Keep the balance live while the app is open.
   *
   * `refresh()` otherwise runs only at boot and after a send, so money arriving
   * from anywhere else — another device, a counterparty paying this address —
   * would not appear until a reload. Fifteen seconds is the cadence the phase-1
   * wallet read used, so the app's freshness is unchanged by moving where the
   * number comes from.
   *
   * A failed poll is swallowed for the same reason a failed boot read is — a
   * dropped refresh must not replace a good balance with an error.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  /*
    The first balance read races the wallet.

    At boot there is often no address yet — Privy mints the embedded wallet
    after this store mounts — so `getBalance` fails and the balance stays `null`.
    That is the honest state, but on its own it would last until the next poll,
    leaving a dash on Home for up to fifteen seconds over a wallet that was
    ready after one. Watching the session's wallet means the figure appears as
    soon as there is an address to read.

    The ref is what keeps this from re-reading the same address twice: whatever
    the session carried at mount was already read by the boot effect, so only a
    later arrival is news.
  */
  const walletAddress = session?.wallet.address ?? null;
  const bootAddress = useRef<string | null>(walletAddress);
  useEffect(() => {
    if (!walletAddress) return;
    if (walletAddress === bootAddress.current) return;
    bootAddress.current = walletAddress;
    void refresh().catch(() => {});
  }, [walletAddress, refresh]);

  const refreshRequests = useCallback(async () => {
    setRequestLog(await requestService.list());
  }, [requestService]);

  /**
   * Say out loud that money moved.
   *
   * Both routes out of the balance — a direct send and paying a request — end
   * here, so the two can never announce the same event in different words.
   *
   * These notices are local: there is no push service behind this list, so the
   * only events in it are ones this app performed and wrote down itself. The
   * bell exists because a send that moves real money and then says nothing
   * anywhere is worse than one that repeats itself.
   */
  const announce = useCallback((transaction: Transaction) => {
    setNotificationLog((current) => [
      {
        id: `ntf_local_${transaction.id}`,
        kind: "payment_sent",
        /*
          No `$` here. `amountDisplay` is the row's own token rendered with its
          own symbol, so a prefix would double it — and, before it carried one,
          would have printed a BTC transfer as a dollar figure.
        */
        title: `You sent ${transaction.recipientName} ${transaction.amountDisplay}`,
        body: "Sent from your MUSD balance.",
        createdAt: transaction.createdAt,
        read: false,
        transactionId: transaction.id,
      },
      ...current,
    ]);
  }, []);

  const recipientById = useCallback(
    (id: string | undefined) =>
      id
        ? (contacts.find((person) => person.id === id) ??
          // Saved first, so a contact the user has kept always wins over a
          // one-off resolution of the same person.
          directory.find((person) => person.id === id) ??
          null)
        : null,
    [contacts, directory],
  );

  const startSend = useCallback(() => {
    setKeypad(clearKeypad());
    setPhase("idle");
    setError(null);
    push("contacts");
  }, [push]);

  const chooseRecipient = useCallback(
    (recipientId: string, amountUnits?: bigint) => {
      // The amount is deliberately kept when swapping recipient mid-flow, but
      // a stale error is not — it was about the person who is no longer
      // selected, and leaving it up would blame the wrong one.
      setError(null);
      setPhase("idle");

      /*
        An amount arriving with the recipient — a scan that resolved a payment
        link, say — becomes the keypad's starting number rather than a separate
        "suggested amount" the user has to accept. Typing over it works exactly
        like correcting a mistake, because it is the same state.
      */
      if (amountUnits !== undefined && amountUnits > 0n) {
        setKeypad({ pending: [], current: unitsToDecimal(amountUnits) });
      }

      push("transfer", { recipientId });
    },
    [push],
  );

  const confirmSend = useCallback(async () => {
    const recipient = recipientById(current.params.recipientId);

    if (!recipient || inFlight.current) return;

    const amountUnits = currentValue(keypad);
    if (amountUnits === null || amountUnits <= 0n) return;

    /*
      A destination with no address behind it.

      Both routes into this list — a saved contact and a scanned handle —
      resolve the address before they will accept anybody, so this should not
      be reachable. It stays because the alternative to a refusal here is a
      signature prompt for a transfer to `undefined`, and "should not happen"
      is not a reason to hand a wallet that.
    */
    if (!recipient.verified || !recipient.address) {
      setError(
        `${recipient.name} has no payment address on file, so there is nowhere to send.`,
      );
      setResetSignal((n) => n + 1);
      return;
    }

    /*
      A known balance that is too small is refused here, before the wallet
      prompts. An *unknown* one is not: `balance === null` means the read has
      not answered, and blocking a send on a number nobody has read would be
      inventing a limit. The chain is the authority in that case, and it will
      refuse an overdraw on its own.
    */
    if (balance !== null && amountUnits > balance) {
      setError("That is more than your available balance.");
      setResetSignal((n) => n + 1);
      return;
    }

    inFlight.current = true;
    setPhase("sending");
    setError(null);

    try {
      const result = await payments.send({ recipient, amountUnits });

      if (!result.ok) {
        setError(result.error);
        setResetSignal((n) => n + 1);
        return;
      }

      setHighlightId(result.transaction.id);
      await refresh();
      announce(result.transaction);

      setKeypad(clearKeypad());
      setPhase("idle");
      reset("success", { transactionId: result.transaction.id });
    } finally {
      inFlight.current = false;
      setPhase("idle");
    }
  }, [balance, current.params.recipientId, keypad, payments, recipientById, refresh, announce, reset]);

  /* ------------------------------------------------------------ requests */

  const createRequest = useCallback(
    async (input: CreateRequestInput): Promise<CreateRequestResult> => {
      const result = await requestService.create(input);
      // Re-read rather than prepending the result, so the list is whatever the
      // service says it is — including the expiry it resolves on read.
      if (result.ok) await refreshRequests();
      return result;
    },
    [requestService, refreshRequests],
  );

  const payRequest = useCallback(
    async (id: string): Promise<SettleRequestResult> => {
      const result = await requestService.pay(id);

      if (result.ok) {
        setHighlightId(result.transaction.id);
        // Both, because paying a request changes two lists: the ledger it
        // wrote to and the requests whose status just stopped being open.
        await Promise.all([refresh(), refreshRequests()]);
        announce(result.transaction);
      }

      return result;
    },
    [announce, refresh, refreshRequests, requestService],
  );

  const declineRequest = useCallback(
    async (id: string) => {
      await requestService.decline(id);
      await refreshRequests();
    },
    [requestService, refreshRequests],
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      await requestService.cancel(id);
      await refreshRequests();
    },
    [requestService, refreshRequests],
  );

  const requestById = useCallback(
    (id: string | undefined) =>
      id ? (requestLog.find((request) => request.id === id) ?? null) : null,
    [requestLog],
  );

  /* ---------------------------------------------------------- onboarding */

  const signIn = useCallback(
    async (provider: AuthProvider, email?: string): Promise<string | null> => {
      const result = await sessions.signIn({ provider, email });
      if (!result.ok) return result.error;
      setSession(result.session);
      return null;
    },
    [sessions],
  );

  const saveProfile = useCallback(
    async (update: ProfileUpdate): Promise<string | null> => {
      try {
        const next = await sessions.updateProfile(update);
        setSession(next);
        return null;
      } catch (e) {
        /*
          A server refusal carries the reason the user needs — most often
          "That username is already taken.", which is the entire point of the
          round-trip. Replacing it with a generic sentence would hide the one
          thing that tells them what to type instead. A network fault carries
          nothing worth showing, so it gets the generic copy.
        */
        if (e instanceof ApiError) return e.message;
        return "Could not save your profile. Try again.";
      }
    },
    [sessions],
  );

  const checkHandle = useCallback(
    (handle: string) => sessions.checkHandle(handle),
    [sessions],
  );

  const setReceipts = useCallback(
    async (link: ReceiptsLink | null) => {
      const next = await sessions.setReceipts(link);
      setSession(next);
    },
    [sessions],
  );

  const signOut = useCallback(async () => {
    await sessions.signOut();
    setSession(null);
    // Everything scoped to the person goes with them.
    setContacts([]);
    setDirectory([]);
    setNotificationLog([]);
    setKeypad(clearKeypad());
    setPhase("idle");
    setError(null);
    setHighlightId(null);
    setBalance(null);
    setTransactions([]);
    setRequestLog([]);
    reset("welcome");
  }, [sessions, reset]);

  /* ------------------------------------------------------- notifications */

  const markNotificationRead = useCallback((id: string) => {
    setNotificationLog((current) =>
      current.map((note) =>
        note.id === id && !note.read ? { ...note, read: true } : note,
      ),
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    // Returns the same array when nothing changes, so an already-clean list
    // does not re-render just because someone pressed the button twice.
    setNotificationLog((current) =>
      current.some((note) => !note.read)
        ? current.map((note) => (note.read ? note : { ...note, read: true }))
        : current,
    );
  }, []);

  /**
   * Empty the list.
   *
   * Only reachable once nothing is unread — the screen swaps its one header
   * action from "Mark all" to "Clear all" rather than offering both. That is
   * the safeguard: clearing cannot lose a notice the user has not seen,
   * because the control does not exist while one is waiting. A confirmation
   * sheet would guard the same thing, at the cost of a tap and a state.
   */
  const clearNotifications = useCallback(() => {
    setNotificationLog([]);
  }, []);

  /* -------------------------------------------------------------- people */

  const addContact = useCallback(
    async (name: string, handle: string): Promise<AddContactResult> => {
      /*
        The server decides. It resolves the handle to an address and either
        stores the row or refuses — a handle that belongs to nobody has nothing
        to store, and telling the user that is better than filing an entry that
        can never be paid.
      */
      const result = await resolved.contacts.add(name, handle);
      if (result.ok) {
        setContacts((current) => [
          ...current.filter((person) => person.id !== result.recipient.id),
          result.recipient,
        ]);
      }
      return result;
    },
    [resolved.contacts],
  );

  const resolveHandle = useCallback(
    async (handle: string): Promise<ResolveHandleResult> => {
      /*
        The directory answers, and it is the only thing that can: the app has no
        way to turn a username into an address on its own. Nothing is stored,
        because a scan is a destination for one payment and not an entry in the
        user's address book.

        The resolved person is held for the send so the transfer screen can look
        them up by id — the same path a saved contact takes, so everything
        downstream of the picker is unchanged.
      */
      const result = await resolved.contacts.lookup(handle);
      if (result.ok) {
        setDirectory((current) => [
          ...current.filter((person) => person.id !== result.recipient.id),
          result.recipient,
        ]);
      }
      return result;
    },
    [resolved.contacts],
  );

  const choosePerson = useCallback(
    (recipient: Recipient) => {
      /*
        A person found by directory search has no contact row. Holding them in
        `directory` is what lets the transfer screen's `recipientById` find
        them — the same shelf a scanned handle uses, and the reason searching
        does not quietly save anybody.
      */
      setDirectory((current) => [
        ...current.filter((person) => person.id !== recipient.id),
        recipient,
      ]);
      chooseRecipient(recipient.id);
    },
    [chooseRecipient],
  );

  const searchDirectory = useCallback(
    (query: string) => resolved.contacts.search(query),
    [resolved.contacts],
  );

  const payAddress = useCallback(
    (address: string): AddressRecipientResult => {
      const result = addressRecipient(address);
      if (!result.ok) return result;

      /*
        Paying yourself is refused, and this is the same refusal the legacy
        payment route already makes ("You can't send to yourself"). The app
        has one wallet and it is the only one holding money, so a transfer from
        it to itself cannot accomplish anything — the balance comes back
        unchanged and the gas does not. There is no version of this the user
        wants, which is what separates it from a limit this codebase would
        otherwise have no business inventing.
      */
      const own = session?.wallet.address;
      if (own && own.toLowerCase() === result.recipient.address?.toLowerCase()) {
        return {
          ok: false,
          error:
            "That is this wallet's own address. Sending to it would only cost the gas.",
        };
      }

      /*
        Held for the send under `directory`, not pushed into `contacts`: an
        address is a destination for one payment, not a person the user chose
        to keep. Then straight to the transfer screen by id, exactly as a
        scanned handle goes — so everything downstream of the picker is
        unchanged and does not need to know which of the three ways in was
        taken.
      */
      setDirectory((current) => [
        ...current.filter((person) => person.id !== result.recipient.id),
        result.recipient,
      ]);
      chooseRecipient(result.recipient.id);

      return result;
    },
    [chooseRecipient, session],
  );

  const amountUnits = useMemo(() => currentValue(keypad), [keypad]);

  /**
   * Newest first.
   *
   * Notices are appended as they happen, so the list is already in order — but
   * a feed reading "Yesterday" above "Today" makes the reader do the sorting
   * themselves, so the order is guaranteed here rather than left to however the
   * entries got in. Sorted once, so nothing that reads this list can disagree
   * about its order.
   */
  const notifications = useMemo(
    () =>
      [...notificationLog].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    [notificationLog],
  );

  const unreadCount = useMemo(
    () => notifications.filter((note) => !note.read).length,
    [notifications],
  );

  const value: PocketStore = {
    ready,
    session,
    balance,
    transactions,
    contacts,
    highlightId,

    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,

    requests: requestLog,
    requestsLoading,
    createRequest,
    payRequest,
    declineRequest,
    cancelRequest,
    requestCapabilities: requestService.capabilities,
    requestById,

    stack,
    current,
    canGoBack: stack.length > 1,
    push,
    replace,
    back,
    reset,

    signIn,
    saveProfile,
    checkHandle,
    setReceipts,
    signOut,

    keypad,
    amountUnits,
    phase,
    error,
    resetSignal,
    pressDigitKey: (digit) => setKeypad((state) => pressDigit(state, digit)),
    pressDecimalKey: () => setKeypad(pressDecimal),
    pressOperatorKey: (op) => setKeypad((state) => pressOperator(state, op)),
    pressBackspaceKey: () => setKeypad(pressBackspace),
    startSend,
    chooseRecipient,
    confirmSend,

    addContact,
    resolveHandle,
    searchDirectory,
    choosePerson,
    payAddress,
    recipientById,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Re-exported so screens can build a "recent" strip without importing data. */
export { recentRecipients };
