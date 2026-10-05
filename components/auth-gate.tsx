"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/**
 * Gate for the authenticated app. Shows a login screen until the user signs in
 * with Privy, a loader while the Pocket user syncs, then the app.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, error, login } = useSession();

  if (!ready) return <Centered>{<Spinner />}</Centered>;

  if (!authenticated) return <LoginScreen onLogin={login} />;

  if (!user) {
    if (error) return <ErrorScreen error={error} onRetry={login} />;
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
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
          Send MUSD.
          <br />
          Pocket handles the chain.
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          Hold, send, and receive MUSD across chains — no gas, no bridging, no
          blockchains to think about.
        </p>
        <Button
          size="lg"
          fullWidth
          onClick={onLogin}
          className="mt-8"
        >
          Continue with X
        </Button>
        <p className="mt-4 text-[13px] text-muted">
          A non-custodial wallet is created for you automatically.
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
