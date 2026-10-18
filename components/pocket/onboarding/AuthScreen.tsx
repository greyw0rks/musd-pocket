"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  BackIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MailIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN_PLAIN, stagger } from "@/components/pocket/theme";
import { Button, IconButton } from "@/components/pocket/ui/Button";
import { Spinner } from "@/components/pocket/ui/Spinner";
import { TextField } from "@/components/pocket/ui/TextField";
import { cn } from "@/lib/utils";
import type { AuthProvider } from "@/features/session/session.types";

/**
 * Screen 02 — Sign in or create an account.
 *
 * The plan asks for a sign-in flow with a provider-ready interface, and this is
 * that interface. In this build it is unreachable: identity is Privy's, and
 * `AuthGate` renders nothing until a session exists, so the app opens straight
 * into Pocket. `signIn` on the real adapter says exactly that rather than
 * faking a hand-off.
 *
 * Two honesty decisions worth naming, because they are the kind of thing that
 * quietly becomes a lie later:
 *
 *  - the provider marks are monograms, not brand logos. Drawing a real wordmark
 *    on a button that contacts nothing would be impersonation. The X mark is
 *    the closest call of the three, since X's logo is itself a letter — what
 *    keeps this one honest is that it is a plain letter in a neutral circle,
 *    not the wordmark, and the note under the buttons says what it does;
 *  - signing in and signing up are the same screen, because they genuinely do
 *    the same thing: one provider hand-off either finds the account or makes
 *    it. A separate "Create account" tab would imply a difference there is not.
 *
 * Google is absent from this list on purpose. It is not how anyone signs in —
 * it is where a receipt copy can be delivered, which is a decision about
 * delivery rather than about identity, and it lives on the profile screen
 * beside the other account facts.
 *
 * The provider buttons are rows now rather than bespoke glass panels. They were
 * the last hand-written surface in the app, with a `bg-white/[0.055]` fill and
 * a `text-white` label that vanished the moment the light theme arrived. As
 * `.pk-li` rows inside a card they are the same shape as every other choice in
 * Pocket, and the monogram disc is the inverse fill, which is the one disc that
 * is guaranteed to read in both themes.
 */
export function AuthScreen() {
  const { push, back, signIn, canGoBack } = usePocket();

  const [pending, setPending] = useState<AuthProvider | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(provider: AuthProvider) {
    if (pending) return;
    setError(null);
    setPending(provider);

    const problem = await signIn(provider, provider === "email" ? email : undefined);

    setPending(null);

    if (problem) {
      setError(problem);
      return;
    }
    push("account-type");
  }

  return (
    <div className={SCREEN_PLAIN}>
      <div className="flex min-h-11 items-center">
        {canGoBack ? (
          <IconButton label="Back" onClick={back}>
            <BackIcon size={22} />
          </IconButton>
        ) : null}
      </div>

      <div className="pt-5">
        <h1 className="pk-h1">Sign in or create account</h1>
        <p className="pk-m mt-2 max-w-[34ch] text-[13px] leading-relaxed">
          One hand-off either finds your account or makes it. Either way you
          arrive with your wallet and your contacts.
        </p>
      </div>

      <div className="mt-6 flex-1 space-y-2.5">
        <div className="pk-card !px-3 !py-1">
          <ProviderRow
            monogram="X"
            label="Continue with X"
            busy={pending === "x"}
            disabled={pending !== null}
            onClick={() => void run("x")}
            index={0}
          />
          <ProviderRow
            monogram="A"
            label="Continue with Apple"
            busy={pending === "apple"}
            disabled={pending !== null}
            onClick={() => void run("apple")}
            index={1}
          />
          <ProviderRow
            monogram={<MailIcon size={15} />}
            label="Continue with email"
            busy={pending === "email" && !emailOpen}
            disabled={pending !== null}
            onClick={() => setEmailOpen((open) => !open)}
            expanded={emailOpen}
            index={2}
          />
        </div>

        {emailOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden pt-1"
          >
            <TextField
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              error={error ?? undefined}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void run("email");
              }}
            />
            <Button
              full
              size="lg"
              className="mt-1"
              loading={pending === "email"}
              disabled={pending !== null}
              onClick={() => void run("email")}
            >
              Continue
            </Button>
          </motion.div>
        ) : error ? (
          <p role="alert" className="px-1 pt-1 text-[11px] text-[var(--r-ink)]">
            {error}
          </p>
        ) : null}
      </div>

      <p className="pk-card pk-m mt-4 leading-relaxed">
        <b className="text-[var(--t)]">Signing in happens before the app opens.</b>{" "}
        If you are reading this, the session has ended or has not started —
        reload to sign in again.
      </p>
    </div>
  );
}

function ProviderRow({
  monogram,
  label,
  busy,
  disabled,
  onClick,
  expanded = false,
  index,
}: {
  monogram: ReactNode;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  expanded?: boolean;
  index: number;
}) {
  const inert = disabled && !expanded;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={stagger(index)}
      whileTap={inert ? undefined : { scale: 0.99 }}
      onClick={onClick}
      disabled={inert}
      aria-expanded={expanded}
      className={cn(
        "pk-li w-full text-left outline-none",
        inert && "cursor-not-allowed opacity-45",
      )}
    >
      <span className="pk-ico !size-9 !bg-[var(--inv)] text-[12px] font-bold text-[var(--invt)]">
        {monogram}
      </span>
      <span className="pk-f">
        <b className="text-[14px]">{label}</b>
      </span>
      {busy ? (
        <Spinner className="!size-4" />
      ) : expanded ? (
        <ChevronDownIcon size={16} className="pk-m" />
      ) : (
        <ChevronRightIcon size={16} className="pk-m" />
      )}
    </motion.button>
  );
}
