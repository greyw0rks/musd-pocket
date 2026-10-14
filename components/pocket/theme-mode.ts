"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Light, dark, or whatever the phone says.
 *
 * A module store rather than a context: the theme is read in two places that
 * are nowhere near each other — the shell, which writes `data-theme`, and the
 * settings row that changes it — and threading a provider between them would
 * mean the whole app re-rendering so one toggle can move.
 *
 * `system` is the default and stays a distinct value from the *resolved*
 * light/dark. Flipping the toggle has to express "I have decided", which is a
 * different thing from "I have not", and collapsing the two would mean the app
 * silently stops following the OS the first time anyone touched the switch.
 */

export type PocketTheme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "pocket.theme";
const QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();
let choice: PocketTheme = "system";

function emit() {
  for (const listener of listeners) listener();
}

function subscribeChoice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* --------------------------------------------------------- system setting */

const systemListeners = new Set<() => void>();
let systemDark = false;
let watched = false;

function watchSystem() {
  if (watched || typeof window === "undefined") return;
  watched = true;
  const query = window.matchMedia(QUERY);
  systemDark = query.matches;
  query.addEventListener("change", (event) => {
    systemDark = event.matches;
    for (const listener of systemListeners) listener();
  });
}

function subscribeSystem(listener: () => void) {
  watchSystem();
  systemListeners.add(listener);
  return () => {
    systemListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ public */

/** Load the stored choice. Idempotent, and callable from anywhere. */
export function hydratePocketTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      choice = stored;
      emit();
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Following
    // the OS is a perfectly good fallback and needs no announcement.
  }
}

export function setPocketTheme(next: PocketTheme) {
  choice = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // As above — the choice still applies for this session.
  }
  emit();
}

export function usePocketTheme(): {
  /** What the user chose. */
  theme: PocketTheme;
  /** What that currently means on screen. */
  resolved: ResolvedTheme;
  setTheme: (next: PocketTheme) => void;
} {
  const theme = useSyncExternalStore(
    subscribeChoice,
    () => choice,
    () => "system" as PocketTheme,
  );

  const prefersDark = useSyncExternalStore(
    subscribeSystem,
    () => systemDark,
    () => false,
  );

  // Read storage once, on mount, so the server and the first client render
  // agree and hydration stays quiet.
  useEffect(() => {
    watchSystem();
    hydratePocketTheme();
  }, []);

  return {
    theme,
    resolved: theme === "system" ? (prefersDark ? "dark" : "light") : theme,
    setTheme: setPocketTheme,
  };
}
