"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/**
 * Gate for the authenticated app. Shows a login screen until the user signs in
 * with Privy, a loader while the Pocket user syncs, then the app.
 *
 * Every branch here has to end in something the user can act on. The one that
 * did not was the last: a signed-in account with no embedded wallet satisfied
 * `authenticated`, never satisfied `user` (there is no address to sync), and
 * could not set an error — a disabled query is `pending` forever and never
 * fails — so it sat on "Setting up your Pocket…" with no way out but a reload
 * that landed in the same place. `walletMissing` names that state so it can be
 * answered instead of waited on.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    error,
    login,
    logout,
    refresh,
    walletMissing,
    isCreatingWallet,
    createWalletError,
    createWallet,
  } = useSession();

  if (!ready) return <Centered>{<Spinner />}</Centered>;

  if (!authenticated) return <LoginScreen onLogin={login} />;

  /*
    Before the sync branches, because there is nothing to sync: this account has
    no wallet, which is also why no error ever arrived.
  */
  if (walletMissing) {
    return (
      <WalletMissingScreen
        creating={isCreatingWallet}
        error={createWalletError}
        onCreate={() => void createWallet()}
        onSignOut={() => void logout()}
      />
    );
  }

  if (!user) {
    /*
      `refresh`, not `login`. A sync that failed is a failed request, and the
      session is fine — re-opening the login modal to fix it asked the user to
      sign in again to retry a fetch, and for a user already signed in it was a
      no-op that left them on the same screen.
    */
    if (error) return <ErrorScreen error={error} onRetry={() => void refresh()} />;
    return (
      <Centered>
        <Spinner label="Setting up your Pocket…" />
      </Centered>
    );
  }

  return <>{children}</>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {children}
    </div>
  );
}

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted">
      <Loader2 className="size-6 animate-spin text-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <Centered>
      <div className="w-full max-w-sm text-center">
        <Wordmark className="justify-center text-2xl" />
        {/*
          This copy is the app's first sentence and it was written for the
          desktop build, when Pocket moved the money and could therefore promise
          to make the chain disappear. Phase 2 inverted that: the wallet the user
          signs in with *is* the money, it signs its own transfers, and gas is
          paid in BTC. "Pocket handles the chain" is now the opposite of true, so
          the two claims that carried it — no gas, no bridging — are gone rather
          than softened.
        */}
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
          Send MUSD.
          <br />
          Your wallet signs it.
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          Signing in creates a wallet only you control. A send is a real MUSD
          transfer from it to whoever you are paying.
        </p>
        <Button
          size="lg"
          fullWidth
          onClick={onLogin}
          className="mt-8"
        >
          {/* Not "Continue with X": the modal this opens offers X, Telegram and
              email, and naming one of the three misdescribes the choice. */}
          Continue
        </Button>
        <p className="mt-4 text-[13px] text-muted">
          This runs on Mezo&rsquo;s testnet. What you hold there is real on that
          chain and worth nothing off it.
        </p>
      </div>
    </Centered>
  );
}

function ErrorScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <Centered>
      <div className="w-full max-w-sm text-center">
        <AlertCircle className="mx-auto size-7 text-error" />
        <p className="mt-4 text-sm text-foreground">{error}</p>
        <Button variant="secondary" onClick={onRetry} className="mt-6">
          Try again
        </Button>
      </div>
    </Centered>
  );
}

/**
 * Signed in, and this account has no wallet.
 *
 * It is a screen rather than an error because nothing went wrong — the sign-in
 * worked, the session is valid, and Privy simply did not mint the wallet that
 * `createOnLogin: "users-without-wallets"` was supposed to mint. That happens
 * for accounts that predate the setting, and for a login that ended before
 * creation did.
 *
 * The wallet is offered rather than made silently, because it is the address
 * the user's money lives at and the address people pay them at: it appearing is
 * a fact about their account, so it is theirs to start. Signing out is offered
 * beside it, because the other explanation for this screen is the wrong account
 * — and there is nowhere else to go if that is what happened.
 */
function WalletMissingScreen({
  creating,
  error,
  onCreate,
  onSignOut,
}: {
  creating: boolean;
  error: string | null;
  onCreate: () => void;
  onSignOut: () => void;
}) {
  return (
    <Centered>
      <div className="w-full max-w-sm text-center">
        <Wordmark className="justify-center text-2xl" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
          One more step
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          You&rsquo;re signed in, but this account doesn&rsquo;t have a wallet
          yet. It&rsquo;s the address your money lives at and where people pay
          you, so it needs to exist before anything else can.
        </p>

        {error ? (
          /*
            A failed creation has to name itself. Privy creates the wallet
            without a UI of its own, so if this is not shown, the button simply
            looks like it did nothing.
          */
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-error" />
            <p className="text-[13px] text-foreground">{error}</p>
          </div>
        ) : null}

        <Button
          size="lg"
          fullWidth
          className="mt-8"
          loading={creating}
          onClick={onCreate}
        >
          Create my wallet
        </Button>
        <Button
          variant="ghost"
          fullWidth
          className="mt-2"
          disabled={creating}
          onClick={onSignOut}
        >
          Use a different account
        </Button>

        <p className="mt-4 text-[13px] text-muted">
          Only you control this wallet. Pocket can&rsquo;t move anything out of
          it.
        </p>
      </div>
    </Centered>
  );
}
