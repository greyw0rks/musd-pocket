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
import { DEMO_BALANCE_UNITS, DEMO_RECIPIENTS } from "@/data/demo-data";
import { DEMO_NOTIFICATIONS } from "@/data/demo-notifications";
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
import { createPaymentService } from "@/features/payments/payment.service";
import type { PaymentService, Recipient, Transaction } from "@/features/payments/payment.types";
import type { PocketNotification } from "@/features/notifications/notification.types";
import { createRequestService } from "@/features/requests/request.service";
import type {
  CreateRequestInput,
  CreateRequestResult,
  PaymentRequest,
  RequestCapabilities,
  RequestService,
  SettleRequestResult,
} from "@/features/requests/request.types";
import { createSessionService } from "@/features/session/session.service";
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
} from "@/features/contacts/api-contact.adapter";
import { ApiError } from "@/lib/auth/client";
import type {
  ScreenId,
  ScreenParams,
  StackEntry,
} from "@/components/pocket/navigation/ids";
import { homeScreenFor } from "@/components/pocket/navigation/screens";

export type { ScreenId, ScreenParams, StackEntry };

/** The transfer screen's two states. Idle while the user is still choosing. */
export type TransferPhase = "idle" | "sending";

interface PocketStore {
  /** False until the session and the ledger have both been read once. */
  ready: boolean;

  /**
   * Whether this app is running on invented data.
   *
   * The same screens serve `/app` (fixtures) and `/home` (the live backend),
   * and a few of them have to know which, because they make claims about the
   * money. "Simulated — no funds moved" is true on one and a lie on the other,
   * and no amount of screen-level cleverness can tell without being told.
   *
   * It is derived from the injected services — a single fact, not a second
   * opinion — so the two cannot disagree.
   */
  demoMode: boolean;

  session: Session | null;
  balance: bigint;
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
   * Async and fallible, because in the real app this is a network round-trip
   * that can refuse: a handle nobody holds has no address to save. The demo
   * never fails, so the result is `{ok:true}` there — the shape is the same
   * either way, which is what lets one screen serve both.
   */
  addContact: (name: string, handle: string) => Promise<AddContactResult>;
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
 * Every field is a service or a seed, and every one of them has a default: the
 * demo implementations below. The real app at `/home` injects the network
 * versions and a `null` contact service (there is no local contact book when
 * the server holds the list), and nothing else about the app changes.
 */
export interface PocketServices {
  payments: PaymentService;
  sessions: SessionService;
  requests: RequestService;
  /**
   * Absent means "keep contacts in memory".
   *
   * The demo has no server, so adding a person is a local array push. The real
   * app has `/api/contacts`, so `addContact` is a request that can fail — and
   * the screen shows that failure rather than a contact it did not save.
   */
  contacts?: ContactService;
  /** Seeded notices. Absent means an empty list — never invented ones. */
  notifications?: PocketNotification[];
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
  services?: PocketServices;
}) {
  /**
   * The contact list as the request service sees it.
   *
   * The service is built once, at boot, while the people a user can ask for
   * money change as they add contacts. A resolver closing over a snapshot would
   * make every contact added after the first render invisible to requests —
   * so it reads through a ref and always sees the current list.
   */
  const contactsRef = useRef<Recipient[]>(services ? [] : DEMO_RECIPIENTS);

  /**
   * The services, resolved once.
   *
   * Injected services win; otherwise this builds the demo set, which is what
   * `/app` has always run on. `demoMode` is derived from the same fact rather
   * than passed separately, so there is one answer to "are we real?" and it
   * cannot disagree with itself.
   */
  const demoMode = !services;
  const [resolved] = useState<PocketServices>(() => {
    if (services) return services;
    // Takes the payment service rather than building one: paying a request has
    // to move money through the same send path as everything else.
    const payments = createPaymentService();
    return {
      payments,
      sessions: createSessionService(),
      requests: createRequestService(
        payments,
        (id) => contactsRef.current.find((person) => person.id === id) ?? null,
      ),
      notifications: DEMO_NOTIFICATIONS,
    };
  });
  const { payments, sessions, requests: requestService } = resolved;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(
    resolved.initialSession ?? null,
  );
  const [balance, setBalance] = useState(demoMode ? DEMO_BALANCE_UNITS : 0n);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contacts, setContacts] = useState<Recipient[]>(
    demoMode ? DEMO_RECIPIENTS : [],
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [notificationLog, setNotificationLog] = useState<PocketNotification[]>(
    resolved.notifications ?? [],
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
   * stale `phase` and both send. This is the one place in the demo where being
   * wrong costs money, so it is the one place that does not wait for a render.
   */
  const inFlight = useRef(false);

  /* ---------------------------------------------------------------- boot */

  useEffect(() => {
    let cancelled = false;

    /*
      Every read is individually fallible, and a failure must not be fatal.

      The demo read from memory and could not fail; these read over a network
      that can. A `Promise.all` would make one dropped request — the contact
      list, say — leave `ready` false forever, which is a splash screen that
      never resolves. Each read therefore falls back to the last known value
      and reports itself, and the app opens either way.

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
          resolved.contacts
            ? read("contacts", resolved.contacts.list(), contacts)
            : Promise.resolve(contacts),
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

        In the real app the first branch cannot be reached: the shell signs the
        user in before this app is mounted, and the adapter only returns null
        when the token itself was rejected.
      */
      if (!existing) {
        setStack([entry("welcome")]);
      } else if (!existing.user.handle) {
        setStack([entry("account-type")]);
      } else {
        setStack([entry(homeScreenFor(existing.user.accountType))]);
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
   * The UI is never allowed to be the source of truth about money, even in a
   * demo — that habit is what produces the bugs this plan exists to avoid.
   */
  const refresh = useCallback(async () => {
    const [nextBalance, nextTransactions] = await Promise.all([
      payments.getBalance(),
      payments.listTransactions(),
    ]);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
  }, [payments]);

  const refreshRequests = useCallback(async () => {
    setRequestLog(await requestService.list());
  }, [requestService]);

  /**
   * Say out loud that money moved.
   *
   * Both routes out of the balance — a direct send and paying a request — end
   * here, so the two can never announce the same event in different words. The
   * demo has no push service, but the bell is the one place a real app would
   * reach the user unprompted, and leaving it on a frozen fixture would hide
   * whether the unread count works at all.
   */
  const announce = useCallback(
    (transaction: Transaction) => {
      setNotificationLog((current) => [
        {
          id: `ntf_local_${transaction.id}`,
          kind: "payment_sent",
          title: `You sent ${transaction.recipientName} $${transaction.amountDisplay}`,
          /*
            The title is true either way — this notice is written by the app
            after a send it performed. The body is not: "nothing left this
            device" is the demo's reassurance, and in the real app money did
            leave the device. Same event, and the mode decides which claim can
            be made about it.
          */
          body: demoMode
            ? "Sent from your MUSD balance. Nothing left this device."
            : "Sent from your MUSD balance.",
          createdAt: transaction.createdAt,
          read: false,
          transactionId: transaction.id,
        },
        ...current,
      ]);
    },
    [demoMode],
  );

  const recipientById = useCallback(
    (id: string | undefined) =>
      id ? (contacts.find((person) => person.id === id) ?? null) : null,
    [contacts],
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

    // A contact added in this session has a handle but no resolved address.
    // Saying so is the only honest option: nothing in this build can turn
    // "@someone" into somewhere to send.
    if (!recipient.verified || !recipient.address) {
      setError(
        `${recipient.name}'s handle has not been resolved to a payment address.`,
      );
      setResetSignal((n) => n + 1);
      return;
    }

    if (amountUnits > balance) {
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
    setContacts(demoMode ? DEMO_RECIPIENTS : []);
    setNotificationLog(demoMode ? DEMO_NOTIFICATIONS : []);
    setKeypad(clearKeypad());
    setPhase("idle");
    setError(null);
    setHighlightId(null);
    setBalance(demoMode ? DEMO_BALANCE_UNITS : 0n);
    setTransactions([]);
    setRequestLog([]);
    reset("welcome");
  }, [sessions, reset, demoMode]);

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
   * sheet would guard the same thing, at the cost of a tap and a state, for a
   * list the demo regenerates on sign-out.
   */
  const clearNotifications = useCallback(() => {
    setNotificationLog([]);
  }, []);

  /* -------------------------------------------------------------- people */

  const addContact = useCallback(
    async (name: string, handle: string): Promise<AddContactResult> => {
      /*
        With a real contact service, the server decides. It resolves the handle
        to an address and either stores the row or refuses — a handle that
        belongs to nobody has nothing to store, and telling the user that is
        better than filing an entry that can never be paid.

        Without one (the demo), this is the local push it has always been: an
        unverified entry with no address, which the contact grid marks as
        "Not verified" rather than showing a tick it did not earn.
      */
      if (resolved.contacts) {
        const result = await resolved.contacts.add(name, handle);
        if (result.ok) {
          setContacts((current) => [
            ...current.filter((person) => person.id !== result.recipient.id),
            result.recipient,
          ]);
        }
        return result;
      }

      const local: Recipient = {
        id: `rcp_local_${Date.now()}`,
        name,
        handle,
        // No address, because nothing resolved one. The UI has to be able to
        // tell the difference, so it is modelled rather than faked.
        verified: false,
      };
      setContacts((current) => [...current, local]);
      return { ok: true, recipient: local };
    },
    [resolved.contacts],
  );

  const amountUnits = useMemo(() => currentValue(keypad), [keypad]);

  /**
   * Newest first.
   *
   * The fixture is written in the order the notices were thought of, not the
   * order they arrived, and a feed reading "Yesterday" above "Today" makes the
   * reader do the sorting themselves. Sorted once here rather than in the
   * screen, so nothing that reads this list can disagree about its order.
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
    demoMode,
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
    recipientById,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Re-exported so screens can build a "recent" strip without importing data. */
export { recentRecipients };
