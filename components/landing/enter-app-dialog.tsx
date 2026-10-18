"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { installSteps } from "@/components/install/steps";
import { useInstall } from "@/components/install/use-install";

/**
 * The door to the app, as a dialog rather than a page.
 *
 * Every "Enter app" link opens this first. The advice is different because the
 * two devices are different products (see `use-install.ts`): a phone gets the
 * install offer, because Pocket is built to be one icon and one tap, and a
 * desktop gets told so plainly — there *is* a desktop site, so it is not a wall,
 * just an honest note that the wallet is a phone-shaped thing.
 *
 * Both versions have a way through. Declining is not a dead end: the caller
 * records the dismissal, so the in-app gate behind this dialog does not ask the
 * same question twice.
 */
export function EnterAppDialog({
  open,
  onOpenChange,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}) {
  const { desktop, canPrompt, ios, install } = useInstall();
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  const steps = installSteps(ios);

  const handleInstall = async () => {
    setBusy(true);
    const accepted = await install();
    setBusy(false);
    // Chrome with no prompt to give (iOS, or withheld) is answered with the
    // steps rather than a pretend install.
    if (!accepted) {
      setShowSteps(true);
      return;
    }
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-3xl border-border bg-surface p-6 sm:max-w-[400px]">
        <div
          aria-hidden
          className="grid size-12 place-items-center rounded-2xl bg-primary pb-0.5 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/30"
        >
          p
        </div>

        <DialogHeader className="mt-4 gap-2 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            {desktop
              ? "Pocket is built for your phone"
              : "Add Pocket to your home screen"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted">
            {desktop
              ? "Sending, requesting and signing in are designed around one thumb on a single screen. The desktop site works, but the wallet feels best on a phone."
              : "It opens full screen, keeps you signed in, and is one tap away. The browser works too — installing just makes it feel like an app."}
          </DialogDescription>
        </DialogHeader>

        {!desktop && showSteps ? (
          <ol className="mt-4 flex list-none flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            {steps.map((step, index) => (
              <li key={step.text} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[13px] font-semibold">
                  {step.icon}
                </span>
                <span className="text-[13px] leading-snug">
                  <b className="mr-1.5 font-semibold text-muted">{index + 1}.</b>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-5 flex flex-col">
          {desktop ? (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-[15px] font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Continue anyway
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleInstall}
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-[15px] font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              >
                {busy ? "Opening…" : canPrompt ? "Install Pocket" : "Show me how"}
              </button>

              <button
                type="button"
                onClick={onContinue}
                disabled={busy}
                className="mt-1 inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:opacity-60"
              >
                Continue in the browser
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
