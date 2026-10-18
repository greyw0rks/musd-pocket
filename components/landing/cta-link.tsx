"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EnterAppDialog } from "@/components/landing/enter-app-dialog";
import { dismissInstallGate, useInstall } from "@/components/install/use-install";

/**
 * The primary conversion action.
 *
 * This is the app's `.pk-btn`: a full-radius pill in the inverse pair — black
 * on the light theme, white on the dark one. It was Mezo orange, which made the
 * marketing page and the product disagree about what a primary action looks
 * like; adopting the brand kit means the biggest button on the site is the same
 * button the wallet uses.
 *
 * Purple stays an accent (see `Eyebrow`, icon chips, data), never the action.
 *
 * Entering the app is a decision, so it goes through a dialog first: a phone is
 * offered the install, a desktop is told the wallet is phone-shaped. Both can
 * continue, and continuing records the dismissal so the install gate inside the
 * app does not ask again. A middle-click or a modifier-click is left alone —
 * opening `/home` in a new tab is its own answer.
 */
export function CtaLink({
  href,
  children,
  className,
  size = "md",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const { ready, standalone } = useInstall();
  const [open, setOpen] = useState(false);

  // An installed app does not need to be sold to itself.
  const intercepts = href === "/home" && ready && !standalone;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!intercepts || event.defaultPrevented) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    setOpen(true);
  };

  const continueIntoApp = () => {
    dismissInstallGate();
    router.push(href);
  };

  return (
    <>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full bg-foreground font-semibold text-background transition-opacity",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          size === "lg" ? "px-7 py-3.5 text-base" : "px-6 py-3 text-[15px]",
          className,
        )}
      >
        {children}
      </Link>

      {intercepts ? (
        <EnterAppDialog
          open={open}
          onOpenChange={setOpen}
          onContinue={continueIntoApp}
        />
      ) : null}
    </>
  );
}
