"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useMemo } from "react";
import { AppShell } from "@/components/pocket/PhoneShell";
import { BorrowScreen } from "@/components/pocket/borrow/BorrowScreen";
import { OpenTroveScreen } from "@/components/pocket/borrow/OpenTroveScreen";
import { RepayTroveScreen } from "@/components/pocket/borrow/RepayTroveScreen";
import { ContactsScreen } from "@/components/pocket/contacts/ContactsScreen";
import { VaultScreen } from "@/components/pocket/earn/VaultScreen";
import { HomeScreen } from "@/components/pocket/home/HomeScreen";
import { AllTransactionsScreen } from "@/components/pocket/ledger/AllTransactionsScreen";
import { TransactionDetailScreen } from "@/components/pocket/ledger/TransactionDetailScreen";
import { FloatingNav } from "@/components/pocket/navigation/FloatingNav";
import type { ScreenId } from "@/components/pocket/navigation/ids";
import {
  dockForScreen,
  screenForTab,
  tabForScreen,
} from "@/components/pocket/navigation/screens";
import { NotificationsScreen } from "@/components/pocket/notifications/NotificationsScreen";
import { AccountTypeScreen } from "@/components/pocket/onboarding/AccountTypeScreen";
import { AuthScreen } from "@/components/pocket/onboarding/AuthScreen";
import { OnboardingDoneScreen } from "@/components/pocket/onboarding/OnboardingDoneScreen";
import { ProfileSetupScreen } from "@/components/pocket/onboarding/ProfileSetupScreen";
import { WelcomeScreen } from "@/components/pocket/onboarding/WelcomeScreen";
import { AccountOverviewScreen } from "@/components/pocket/profile/AccountOverviewScreen";
import { ProfileScreen } from "@/components/pocket/profile/ProfileScreen";
import { SettingsScreen } from "@/components/pocket/profile/SettingsScreen";
import { WithdrawBtcScreen } from "@/components/pocket/profile/WithdrawBtcScreen";
import { ReceiveScreen } from "@/components/pocket/receive/ReceiveScreen";
import { RequestDetailScreen } from "@/components/pocket/request/RequestDetailScreen";
import { RequestScreen } from "@/components/pocket/request/RequestScreen";
import { RequestsScreen } from "@/components/pocket/request/RequestsScreen";
import { ScanScreen } from "@/components/pocket/scan/ScanScreen";
import { PocketProvider, recentRecipients, usePocket } from "@/components/pocket/store";
import type { PocketServices } from "@/components/pocket/store";
import { SuccessScreen } from "@/components/pocket/success/SuccessScreen";
import { TransferScreen } from "@/components/pocket/transfer/TransferScreen";
import { Button } from "@/components/pocket/ui/Button";
import { Walkthrough } from "@/components/pocket/walkthrough/Walkthrough";
import { startTour } from "@/components/pocket/walkthrough/store";
import { Wordmark } from "@/components/wordmark";
import { MODAL_MOTION, PAGE_MOTION, RESULT_MOTION } from "@/components/pocket/theme";
import { toDisplayUnits } from "@/features/payments/amount";
import { useBorrow } from "@/hooks/use-borrow";
import { useFaucet } from "@/hooks/use-faucet";
import { EmbeddedWalletActivator, useLiveWallet } from "@/hooks/use-live-wallet";
import { hasPrivy } from "@/lib/wallet/privy";

/**
 * Pocket.
 *
 * The host, and nothing else. It owns the shell, the stack, and which screen
 * is on top — never the data. Balance, ledger, session, contacts and the send
 * flow all live in `PocketProvider`, so a screen can be replaced without
 * anything else moving.
 *
 * This is also the app's only switch: `Screen` below maps an id to a
 * component. Screen ids and that switch are the two places a new screen has to
 * be declared, and both are in the type checker's view, so a screen in the
 * union with no case is a compile error rather than a blank panel.
 *
 * `services` is not optional and has no default. Every read and write this app
 * makes goes to the server or to the chain; there is no second set of
 * implementations behind this interface to fall back on.
 */
export function PocketApp({ services }: { services: PocketServices }) {
  return (
    <MotionConfig reducedMotion="user">
      <PocketProvider services={services}>
        <PocketHost />
      </PocketProvider>
    </MotionConfig>
  );
}

function PocketHost() {
  const { ready, current, back, reset } = usePocket();

  const variants = useMemo(() => {
    switch (current.id) {
      // A modal moment rather than a place.
      case "transfer":
        return MODAL_MOTION;
      // Terminal screens — a receipt, the end of onboarding.
      case "success":
      case "onboarding-done":
        return RESULT_MOTION;
      default:
        return PAGE_MOTION;
    }
  }, [current.id]);

  return (
    <AppShell screen={current.id}>
      {/*
        Makes the Privy embedded wallet the account wagmi reads from. Rendered
        only when Privy is configured — the hook it needs lives under
        `PrivyProvider`, which `app/providers` does not mount without keys, so
        this must not run unconditionally.
      */}
      {hasPrivy() ? <EmbeddedWalletActivator /> : null}
      {!ready ? (
        <Splash />
      ) : (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/*
            Keyed by the stack entry's counter, not by the screen id: two
            visits to the same screen are two different moments, and keying by
            id would make the second one slide in without the first sliding
            out.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.key}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="pocket-layer absolute inset-0 flex flex-col"
            >
              <Screen id={current.id} onBack={back} />
            </motion.div>
          </AnimatePresence>

          {/*
            The dock, under the three tops and under nothing else.

            A sibling of the motion layer rather than a child of it: the layer is
            `absolute inset-0` and swaps wholesale on every navigation, so a dock
            inside it would slide out and back in on every push. Here it stays
            where it is, and `.pk-nav`'s `position: absolute` resolves against
            this wrapper — which is why the wrapper is relative.

            `reset`, not `push`: a tab is a place, and tapping Vault and then
            Home must not leave a Home→Vault→Home history behind it. Which
            screens own a dock and which tab each one reads as is
            `navigation/screens.ts`'s job, so this component holds no opinion
            about either.
          */}
          <AnimatePresence>
            {dockForScreen(current.id) ? (
              <FloatingNav
                key="dock"
                active={tabForScreen(current.id)}
                onChange={(tab) => reset(screenForTab(tab))}
              />
            ) : null}
          </AnimatePresence>

          {/*
            The first-run walkthrough, over everything including the dock.

            A sibling of the screen layer rather than a child of it: it
            spotlights elements on Home *and* the dock, and the dock is not
            inside the moving layer. Mounted here, it survives a screen swap
            without being unmounted, which is what lets it close itself cleanly
            if the user navigates away mid-tour.

            It decides whether to appear on its own — see `walkthrough/tour.ts`
            — and does not render anything until it has.
          */}
          <Walkthrough screenId={current.id} />
        </div>
      )}
    </AppShell>
  );
}

/** Which component a screen id means — the app's one switch. */
function Screen({ id, onBack }: { id: ScreenId; onBack: () => void }) {
  const {
    session,
    balance,
    transactions,
    contacts,
    highlightId,
    notifications,
    unreadCount,
    requests,
    requestsLoading,
    requestCapabilities,
    createRequest,
    payRequest,
    declineRequest,
    cancelRequest,
    requestById,
    current,
    keypad,
    phase,
    error,
    resetSignal,
    startSend,
    chooseRecipient,
    confirmSend,
    pressDigitKey,
    pressDecimalKey,
    pressOperatorKey,
    pressBackspaceKey,
    addContact,
    resolveHandle,
    payAddress,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    recipientById,
    reset,
    replace,
    push,
  } = usePocket();

  const accountType = session?.user.accountType ?? "personal";

  /*
    The chain readings that are not the balance: gas and the network. Called
    once here so the screens that show them cannot disagree.

    The balance is deliberately not here: it comes from the store, which reads it
    through the payment service. See `hooks/use-live-wallet.ts`.
  */
  const liveWallet = useLiveWallet();

  /*
    The Trove, read once here and handed to whichever screen is showing.

    Unconditional, and it has to be: this function returns from inside the
    switch, so a hook called in one case would run on the renders that reach
    that case and not on the others — a different number of hooks per render,
    which React rejects outright. Called at the top it is one hook always, and
    the query itself is dormant when signed out (`enabled: Boolean(user)`) and
    shares a single cache key with the Borrow screens, so the screens that need
    it pay nothing extra and the screens that do not pay nothing at all.

    Read for Home, which is the one screen that shows the debt outside the
    Borrow stack: the available balance there is the wallet's MUSD, and when a
    Trove is open part of that MUSD is drawn rather than owned.
  */
  const borrow = useBorrow();
  /*
    The faucet shares the same rule as `useBorrow` above: one call at the top,
    so every screen runs the same hooks, and the query stays dormant until
    there is a session (`enabled: Boolean(user)`). Home reads it; the other
    screens carry an idle controller.
  */
  const faucet = useFaucet();
  const hasTrove = borrow.data?.hasTrove ?? false;

  /*
    The debt in the UI's minor units, or `null`.

    `debt` arrives as 18-decimal wei — the chain's unit for a Trove — and
    `toDisplayUnits` is the one place that bridges to the app's 2-decimal money
    unit. It divides by 10^16 and truncates, so a debt under a cent comes back
    as `0n`, which the card folds into `null` and prints as `$0.00`.

    `null` therefore means "nothing owed" *or* "not read yet" — the two are not
    distinguishable from this figure, and the card does not try: it draws the
    decomposition and the repayment line either way, with the borrowed half at
    zero. Withholding them on an unread read would leave the card half-furnished
    in the state most users are in most of the time.
  */
  const borrowedUnits =
    hasTrove && borrow.data ? toDisplayUnits(BigInt(borrow.data.debt)) : null;

  switch (id) {
    case "welcome":
      return <WelcomeScreen />;
    case "auth":
      return <AuthScreen />;
    case "account-type":
      return <AccountTypeScreen />;
    case "profile-setup":
      return <ProfileSetupScreen />;
    case "onboarding-done":
      return <OnboardingDoneScreen />;

    case "home":
      return (
        <HomeScreen
          user={{
            name: session?.user.name ?? "",
            avatarUrl: session?.user.avatarUrl,
          }}
          balance={balance}
          transactions={transactions}
          recipients={contacts}
          highlightId={highlightId}
          unreadCount={unreadCount}
          faucet={faucet}
          onSend={startSend}
          onRequest={() => push("request")}
          onReceive={() => push("receive")}
          onBorrow={() => push("borrow")}
          /*
            The debt, and the way to settle it. Both are drawn whether or not a
            Trove is open: `borrowedUnits` decomposes the available balance into
            what is owned and what is drawn against Bitcoin, and the Repay
            button puts the exit in the card's corner. With no Trove the halves
            read `$X yours + $0.00 borrowed` and the button is disabled — the
            card keeps its shape, and borrowing stops being a door with no
            handle on it.
          */
          borrowedUnits={borrowedUnits}
          onRepay={() => push("borrow-repay")}
          /*
            Native BTC, read from Mezo, and what it is worth. `valueUnits` is
            `null` until a price has been read — the card prints the amount and
            says the valuation is pending rather than inventing one, and keeps
            an unpriced holding out of the total so a partial sum is never read
            as everything the user holds.
          */
          btc={
            liveWallet?.btc != null
              ? { amount: liveWallet.btc, valueUnits: liveWallet.btcValueUnits }
              : null
          }
          onOpenNotifications={() => push("notifications")}
          onOpenAccount={() => push("account-overview")}
          onOpenLedger={() => push("transactions")}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );

    case "settings":
      return (
        <SettingsScreen
          user={{
            name: session?.user.name ?? "",
            handle: session?.user.handle ?? "",
            accountType,
          }}
          onBack={onBack}
          onOpenAccount={() => push("account-overview")}
          onOpenContacts={() => push("contacts")}
          onOpenReceive={() => push("receive")}
          onOpenWithdrawBtc={() => push("withdraw-btc")}
          /*
            Reset rather than push: the tour is about Home, and every step
            points at an element there. Opening it over Settings would leave
            four of five steps pointing at nothing.
          */
          onStartTour={() => {
            reset("home");
            startTour();
          }}
          onSignOut={() => reset("welcome")}
        />
      );

    /*
      Pushed from Settings and left by the back arrow. There is no dashboard to
      replace and nothing to invalidate on the way out beyond what the screen
      already did when the transfer landed.
    */
    case "withdraw-btc":
      return <WithdrawBtcScreen onBack={onBack} />;

    case "account-overview":
      return (
        <AccountOverviewScreen
          user={{
            name: session?.user.name ?? "",
            handle: session?.user.handle ?? "",
            avatarUrl: session?.user.avatarUrl,
            accountType,
          }}
          balance={balance}
          // From the session, not a constant: the wallet status is whatever
          // the user's account actually has.
          wallet={session?.wallet ?? { status: "none" }}
          /*
            The chain's network reading, for the Network row. There used to be
            two chain facts here — this and a separate on-chain mUSD figure —
            because `balance` above was the Pocket ledger and the wallet held
            something else. There is one balance now and it *is* the wallet's
            mUSD, so a second figure would be the same number twice, and the row
            that carried it is gone.
          */
          network={liveWallet?.network ?? null}
          onBack={onBack}
          onEditProfile={() => push("profile")}
          onOpenSettings={() => push("settings")}
        />
      );

    case "contacts":
      return (
        <ContactsScreen
          recipients={contacts}
          recent={recentRecipients(transactions, contacts)}
          user={{
            name: session?.user.name ?? "",
            handle: session?.user.handle ?? "",
            avatarUrl: session?.user.avatarUrl,
          }}
          onSelect={(recipient) => chooseRecipient(recipient.id)}
          onAdd={addContact}
          onPayAddress={payAddress}
          onScan={() => push("scan")}
          onBack={onBack}
        />
      );

    case "profile":
      return (
        <ProfileScreen
          onBack={onBack}
          onOpenSettings={() => push("settings")}
        />
      );

    /* ------------------------------------------------- 3 · receive & ask */

    case "receive":
      return (
        <ReceiveScreen
          name={session?.user.businessName || session?.user.name || ""}
          handle={session?.user.handle || "@you"}
          avatarUrl={session?.user.avatarUrl}
          onBack={onBack}
          onRequestAmount={() => push("request")}
        />
      );

    case "scan":
      return (
        <ScanScreen
          onBack={onBack}
          /*
            Resolution goes through the store rather than a list held here: it
            is a directory lookup that can refuse, and the send that follows it
            does not care — a resolved person and a saved contact reach the
            transfer screen the same way.
          */
          onResolve={resolveHandle}
          // The amount a link carried comes with the recipient, so a scanned
          // request lands on the keypad already filled in rather than asking
          // the payer to retype a figure the other side already stated.
          onResolved={(recipientId, amountUnits) =>
            chooseRecipient(recipientId, amountUnits)
          }
          onOpenReceive={() => push("receive")}
        />
      );

    case "requests":
      return (
        <RequestsScreen
          requests={requests}
          loading={requestsLoading}
          onBack={onBack}
          onOpen={(requestId) => push("request-detail", { requestId })}
          onNew={() => push("request")}
        />
      );

    case "request":
      return (
        <RequestScreen
          contacts={contacts}
          // The transfer screen's Request tab arrives here carrying the person
          // it was already showing, so asking someone for money does not start
          // by making you pick them out again.
          initialCounterparty={recipientById(current.params.recipientId)}
          onCreate={createRequest}
          onBack={onBack}
          // Replaces rather than pushes: the composer has done its job, and
          // leaving it underneath would put an empty form behind the request
          // it just made.
          onCreated={(requestId) => replace("request-detail", { requestId })}
          /*
            The mirror of the send screen's ask control. Asking the wrong
            person for money is the same mistake as paying the wrong person,
            so the way out of each sits in the same place.
          */
          onSend={(person) => chooseRecipient(person.id)}
        />
      );

    case "request-detail": {
      const request = requestById(current.params.requestId);
      if (!request) return <MissingScreen onBack={onBack} />;

      return (
        <RequestDetailScreen
          request={request}
          counterparty={recipientById(request.counterpartyId)}
          onBack={onBack}
          onPay={() => payRequest(request.id)}
          onPaid={(transactionId) => push("success", { transactionId })}
          onDecline={() => declineRequest(request.id)}
          onCancel={() => cancelRequest(request.id)}
          /*
            Whether the two controls above are drawn at all. The service knows
            which of them it can do; the screen would otherwise offer a button
            that can only fail.
          */
          canDecline={requestCapabilities.decline}
          canWithdraw={requestCapabilities.withdraw}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );
    }

    case "transactions":
      return (
        <AllTransactionsScreen
          transactions={transactions}
          recipients={contacts}
          onBack={onBack}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );

    case "transaction": {
      const receipt = transactions.find(
        (tx) => tx.id === current.params.transactionId,
      );
      if (!receipt) return <MissingScreen onBack={onBack} />;

      return (
        <TransactionDetailScreen
          transaction={receipt}
          recipient={recipientById(receipt.recipientId)}
          onBack={onBack}
          onSendAgain={(recipientId) => chooseRecipient(recipientId)}
        />
      );
    }

    case "notifications":
      return (
        <NotificationsScreen
          notifications={notifications}
          onBack={onBack}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
          onOpenRequest={(requestId) => push("request-detail", { requestId })}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onClearAll={clearNotifications}
        />
      );

    case "transfer": {
      const recipient = recipientById(current.params.recipientId);
      if (!recipient) return <MissingScreen onBack={onBack} />;

      return (
        <TransferScreen
          recipient={recipient}
          keypad={keypad}
          balance={balance}
          phase={phase}
          error={error}
          resetSignal={resetSignal}
          onDigit={pressDigitKey}
          onDecimal={pressDecimalKey}
          onOperator={pressOperatorKey}
          onBackspace={pressBackspaceKey}
          onConfirm={() => void confirmSend()}
          onChangeRecipient={onBack}
          onRequest={() =>
            replace("request", { recipientId: current.params.recipientId })
          }
          onBack={onBack}
        />
      );
    }

    case "success": {
      const receipt = transactions.find(
        (tx) => tx.id === current.params.transactionId,
      );
      if (!receipt) return <MissingScreen onBack={onBack} />;

      return (
        <SuccessScreen
          transaction={receipt}
          onDone={() => reset("home")}
          /*
            Pushed rather than replaced. The receipt is the end of the flow, so
            back has to come here rather than to the keypad that sent it —
            reopening a composer that has already fired would invite a second
            send.
          */
          onViewDetails={() => push("transaction", { transactionId: receipt.id })}
        />
      );
    }

    case "borrow":
      return (
        <BorrowScreen
          onBack={onBack}
          onOpenTrove={() => push("borrow-open")}
          onRepay={() => push("borrow-repay")}
        />
      );

    case "borrow-open":
      /*
        `replace` rather than `push` on the way out. The dashboard is where both
        of these were entered from and where they return to, so pushing would
        stack a second copy of it — and backing out of that copy would land on
        the form again, which is the one screen that must not be re-entered
        after it has fired.
      */
      return (
        <OpenTroveScreen onBack={onBack} onDone={() => replace("borrow")} />
      );

    case "borrow-repay":
      return (
        <RepayTroveScreen onBack={onBack} onDone={() => replace("borrow")} />
      );

    /*
      A place, not a push: reached from the dock and left by the dock, with
      nothing behind it. It owns no back arrow for that reason — `VaultScreen`
      draws `PageHeading` instead of `ScreenHeader`.
    */
    case "vault":
      return <VaultScreen />;
  }
}

/**
 * A screen asked for something that is no longer there.
 *
 * Reached if a receipt is opened after the ledger changed, or a transfer is
 * started for a contact that has since gone. Rare, but a blank white panel is
 * a worse answer than a sentence and a way out.
 */
function MissingScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-[15px] font-semibold text-[var(--t)]">
        That is no longer available
      </p>
      <p className="max-w-[32ch] text-[12px] leading-relaxed text-[var(--m)]">
        Whatever this was pointing at has changed. Head back and it will be
        rebuilt from the current state.
      </p>
      <Button size="sm" onClick={onBack}>
        Go back
      </Button>
    </div>
  );
}

/**
 * Shown while the app is loading its first state.
 *
 * What it is waiting on is `/api/users/me`, the contact list, the ledger and a
 * Privy wallet read — the label names the wallet because that is the one the
 * user is holding, and it is honest about whose turn it is.
 *
 * The mark is the same one-dot wordmark the landing header carries. The splash
 * is the first frame of Pocket anyone sees, so it uses the brand lockup rather
 * than an invented "M" badge that appears nowhere else.
 */
function Splash() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <Wordmark tone="app" className="text-2xl" />

      <motion.span
        animate={{ opacity: [0.25, 0.8, 0.25] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-[11px] font-medium tracking-wide text-[var(--m)] uppercase"
      >
        Loading your wallet
      </motion.span>
    </div>
  );
}
