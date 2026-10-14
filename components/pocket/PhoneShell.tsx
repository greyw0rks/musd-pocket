"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePocketTheme } from "@/components/pocket/theme-mode";

/**
 * The app container.
 *
 * Deliberately not a device mock-up. Pocket is a real mobile web app, so on a
 * phone this is simply the viewport; on anything wider it stays a phone's
 * width and rounds off, and the backdrop behind it is its own colour rather
 * than a black void. There is no status bar and no fake clock.
 *
 * This is also where the theme lands. `data-theme` goes on `.pocket-root`
 * because that is the element the token block is scoped to, and every colour
 * in the app resolves from it — so one attribute flips the whole tree with no
 * component having to know which theme is running. Left `system`, the
 * attribute is omitted entirely and the stylesheet's media query decides,
 * which is what keeps the OS setting live without a listener per component.
 *
 * `data-screen` stays from the previous pass: screen-dependent styling keys
 * off it, and it is how a test can assert which screen it is looking at.
 */
export function AppShell({
  screen,
  children,
  className,
}: {
  screen: string;
  children: ReactNode;
  className?: string;
}) {
  const { theme } = usePocketTheme();

  return (
    <div
      data-screen={screen}
      data-theme={theme === "system" ? undefined : theme}
      className="pocket-root flex min-h-[100svh] w-full justify-center font-sans antialiased"
    >
      <div className={cn("pk-app", className)}>{children}</div>
    </div>
  );
}
