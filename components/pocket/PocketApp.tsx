"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useMemo } from "react";
import { AppShell } from "@/components/pocket/PhoneShell";
import { BorrowScreen } from "@/components/pocket/borrow/BorrowScreen";
import { ContactsScreen } from "@/components/pocket/contacts/ContactsScreen";
import { HomeScreen } from "@/components/pocket/home/HomeScreen";
import { MerchantHomeScreen } from "@/components/pocket/merchant/MerchantHomeScreen";
import { MerchantPaymentDetailScreen } from "@/components/pocket/merchant/MerchantPaymentDetailScreen";
import { MerchantPaymentsScreen } from "@/components/pocket/merchant/MerchantPaymentsScreen";
import { MerchantProfileScreen } from "@/components/pocket/merchant/MerchantProfileScreen";
import { MerchantQrScreen } from "@/components/pocket/merchant/MerchantQrScreen";
import { MerchantReceiveScreen } from "@/components/pocket/merchant/MerchantReceiveScreen";
import { MerchantSettingsScreen } from "@/components/pocket/merchant/MerchantSettingsScreen";
import { AllTransactionsScreen } from "@/components/pocket/ledger/AllTransactionsScreen";
import { TransactionDetailScreen } from "@/components/pocket/ledger/TransactionDetailScreen";
import { FloatingNav } from "@/components/pocket/navigation/FloatingNav";
import type { ScreenId } from "@/components/pocket/navigation/ids";
import { NotificationsScreen } from "@/components/pocket/notifications/NotificationsScreen";
import {
  dockForScreen,
  homeScreenFor,
  screenForTab,
  tabForScreen,
} from "@/components/pocket/navigation/screens";
import { AccountTypeScreen } from "@/components/pocket/onboarding/AccountTypeScreen";
import { AuthScreen } from "@/components/pocket/onboarding/AuthScreen";
import { OnboardingDoneScreen } from "@/components/pocket/onboarding/OnboardingDoneScreen";
import { ProfileSetupScreen } from "@/components/pocket/onboarding/ProfileSetupScreen";
import { WelcomeScreen } from "@/components/pocket/onboarding/WelcomeScreen";
import { AccountOverviewScreen } from "@/components/pocket/profile/AccountOverviewScreen";
import { ProfileScreen } from "@/components/pocket/profile/ProfileScreen";
import { SettingsScreen } from "@/components/pocket/profile/SettingsScreen";
import { ReceiveScreen } from "@/components/pocket/receive/ReceiveScreen";
import { RequestDetailScreen } from "@/components/pocket/request/RequestDetailScreen";
import { RequestScreen } from "@/components/pocket/request/RequestScreen";
import { RequestsScreen } from "@/components/pocket/request/RequestsScreen";
import { ScanScreen } from "@/components/pocket/scan/ScanScreen";
import { PocketProvider, recentRecipients, usePocket } from "@/components/pocket/store";
import type { PocketServices } from "@/components/pocket/store";
import { SpendingScreen } from "@/components/pocket/spending/SpendingScreen";
import { SuccessScreen } from "@/components/pocket/success/SuccessScreen";
import { TransferScreen } from "@/components/pocket/transfer/TransferScreen";
import { Button } from "@/components/pocket/ui/Button";
import { VaultScreen } from "@/components/pocket/vault/VaultScreen";
import { MODAL_MOTION, PAGE_MOTION, RESULT_MOTION } from "@/components/pocket/theme";

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
 * `services` is how the same app runs against two different worlds. Omitted —
 * as `/app` omits it — the provider builds the demo set and nothing here sends
 * a request. Supplied, as `/home` supplies it, every read and write goes to the
 * server and the demo data is never seeded.
 */
export function PocketApp({ services }: { services?: PocketServices }) {
  return (
    <MotionConfig reducedMotion="user">
      <PocketProvider services={services}>
        <PocketHost />
      </PocketProvider>
    </MotionConfig>
  );
}

function PocketHost() {
  const { ready, demoMode, current, session, back, replace } = usePocket();

  const accountType = session?.user.accountType ?? "personal";
  const dock = dockForScreen(current.id, accountType, demoMode);
  const activeTab = tabForScreen(current.id, accountType, demoMode);

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
      {!ready ? (
        <Splash demoMode={demoMode} />
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
            The dock replaces the stack rather than pushing onto it. A tab is a
            place you are, not a step you took — back should not walk through
            the tabs you visited on the way here.
          */}
          <AnimatePresence>
            {dock && activeTab ? (
              <FloatingNav
                key={dock}
                active={activeTab}
                accountType={accountType}
                demoMode={demoMode}
                onChange={(tab) => replace(screenForTab(tab, accountType))}
              />
            ) : null}
          </AnimatePresence>
        </div>
      )}
    </AppShell>
  );
}

/** Which component a screen id means — the app's one switch. */
function Screen({ id, onBack }: { id: ScreenId; onBack: () => void }) {
  const {
    session,
    demoMode,
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
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    recipientById,
    reset,
    replace,
    push,
  } = usePocket();

  const accountType = session?.user.accountType ?? "personal";

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
          onSend={startSend}
          onRequest={() => push("request")}
          onReceive={() => push("receive")}
          /*
            Both the Borrow tile and the Repay notch on the balance card land
            here. Repaying and borrowing are one screen because a repayment is
            a payment against the same trove the borrow would open — and with
            no trove on either side, splitting them would be two screens
            saying the same nothing.

            It is demo-only. The borrow screen prices a trove out of invented
            collateral and an invented rate, so in the real app it would be a
            page of numbers about the user's actual wallet that nothing on
            chain backs. Handing `onBorrow` in as absent is the whole switch:
            the tile and the notch both go, and the balance card stops
            presenting its total as borrowed-plus-received. See `BalanceCards`.
          */
          onBorrow={demoMode ? () => push("borrow") : undefined}
          onOpenNotifications={() => push("notifications")}
          onOpenAccount={() => push("account-overview")}
          onOpenLedger={() => push("transactions")}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );

    /* ------------------------------------------------------ 2 · tabs */

    /*
      Vault and Spending are places, not steps: they are reached from the dock
      and they replace what is on screen rather than stacking on top of it, so
      neither takes a back control. Spending draws entirely from the ledger the
      user can already read; the vault has nothing in it yet and says so.
    */
    case "vault":
      return <VaultScreen />;

    case "spending":
      return (
        <SpendingScreen
          transactions={transactions}
          recipients={contacts}
          highlightId={highlightId}
          onOpenTransaction={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );

    case "borrow":
      return <BorrowScreen onBack={onBack} />;

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
          onSignOut={() => reset("welcome")}
        />
      );

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
          // From the session, not a constant: `/home` has a real wallet and
          // `/app` has a status the fixtures set.
          wallet={session?.wallet ?? { status: "none" }}
          onBack={onBack}
          onEditProfile={() => push("profile")}
          onOpenSettings={() => push("settings")}
        />
      );

    case "merchant-home":
      return <MerchantHomeScreen />;

    case "merchant-profile":
      return <MerchantProfileScreen />;

    case "merchant-payments":
      return <MerchantPaymentsScreen />;

    case "merchant-receive":
      return <MerchantReceiveScreen onBack={onBack} />;

    case "merchant-qr":
      return <MerchantQrScreen onBack={onBack} />;

    /*
      A merchant asking a customer to settle a bill is the same act as a person
      asking a friend to split one, so it is the same composer with different
      words rather than a second screen that would drift from this one. The
      requests it creates land in the same list, settle through the same
      service, and are read back by the same detail screen.
    */
    case "merchant-request":
      return (
        <RequestScreen
          contacts={contacts}
          title="Payment request"
          subtitle="Ask a customer to settle up"
          notePlaceholder="Table 4, two flat whites"
          onCreate={createRequest}
          onBack={onBack}
          onCreated={(requestId) => replace("request-detail", { requestId })}
        />
      );

    case "merchant-payment-detail": {
      const payment = transactions.find(
        (tx) => tx.id === current.params.transactionId,
      );
      if (!payment) return <MissingScreen onBack={onBack} />;

      return (
        <MerchantPaymentDetailScreen
          transaction={payment}
          onBack={onBack}
          onOpenReceipt={(transactionId) =>
            push("transaction", { transactionId })
          }
        />
      );
    }

    case "merchant-settings":
      return <MerchantSettingsScreen onBack={onBack} />;

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
          contacts={contacts}
          onBack={onBack}
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
          onDone={() => reset(homeScreenFor(accountType))}
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
 * The two worlds do not take the same amount of time to answer, and the label
 * says which one is being waited on: `/app` reads a fixture module, `/home`
 * waits on `/api/users/me` and a Privy wallet. "Loading demo data" over a real
 * sign-in is the first thing the user would read in the real app and the one
 * sentence that must not be wrong there.
 *
 * The brand mark is the purple the rest of the app is built around, not the
 * green the old dark theme used — the splash is the first frame of Pocket
 * anyone sees and it should not advertise a colour the app no longer has.
 */
function Splash({ demoMode }: { demoMode: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--p)] text-base font-bold text-white">
          M$
        </span>
        <span className="text-xl font-semibold tracking-tight text-[var(--t)]">
          Pocket
        </span>
      </div>

      <motion.span
        animate={{ opacity: [0.25, 0.8, 0.25] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-[11px] font-medium tracking-wide text-[var(--m)] uppercase"
      >
        {demoMode ? "Loading demo data" : "Loading your wallet"}
      </motion.span>
    </div>
  );
}
