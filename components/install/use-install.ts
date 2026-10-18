"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Install state, in one place.
 *
 * Three facts decide whether the gate shows: whether the app is already running
 * as an installed app, whether the person has dismissed the gate before, and
 * whether this is a phone or a desktop. The last one is not cosmetic — the
 * product has a desktop surface, so blocking a desktop visitor behind a
 * "install this" wall would be asking them to install the phone app on a
 * machine that does not have a home screen.
 *
 * This is read through `useSyncExternalStore` rather than a `useEffect` that
 * sets state on mount. Setting state in an effect is exactly what the lint rule
 * forbids, and rewriting it as a subscription is also the more honest model:
 * `beforeinstallprompt` is an event, and the gate is a view of a small piece of
 * browser state, not a copy of it.
 */

const DISMISS_KEY = "pocket:install-gate:v1";
const CHANGE_EVENT = "pocket:install-change";

/**
 * Chrome's install event is not in the DOM lib because the spec is still
 * Chromium's alone. The shape is stable and documented.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallSnapshot {
  /** False during the server render and the first client paint. */
  ready: boolean;
  /** Running from the home screen / installed window, not a browser tab. */
  standalone: boolean;
  /** The person said "not now" once. */
  dismissed: boolean;
  /** A pointer-and-keyboard viewport — the desktop site, not a phone. */
  desktop: boolean;
  /** Chrome offered a real install prompt we can trigger on a tap. */
  canPrompt: boolean;
  /** iOS has no `beforeinstallprompt`; the instructions are manual. */
  ios: boolean;
}

const NOT_READY: InstallSnapshot = {
  ready: false,
  standalone: false,
  dismissed: false,
  desktop: false,
  canPrompt: false,
  ios: false,
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let snapshot: InstallSnapshot = NOT_READY;
let listenersBound = false;

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Treating
    // that as "not dismissed" is the safer failure: the gate is dismissible,
    // so the cost is one extra tap, not a trap.
    return false;
  }
}

/** Write the dismissal and tell every subscriber. Never throws. */
export function dismissInstallGate(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* storage unavailable — the in-memory snapshot still hides the gate */
  }
  refresh();
}

function compute(): InstallSnapshot {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari on iOS exposes this non-standard flag instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return {
    ready: true,
    standalone,
    dismissed: isDismissed(),
    // `pointer: fine` is what separates a desktop from a tablet pretending to
    // be one. Width alone would class a landscape phone as a desktop.
    desktop: window.matchMedia("(pointer: fine)").matches,
    canPrompt: deferredPrompt !== null,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
  };
}

/**
 * Read and cache. `useSyncExternalStore` calls the snapshot reader on every
 * render and requires the same object back while nothing has changed, so the
 * identity only turns over when a field does.
 */
function readSnapshot(): InstallSnapshot {
  if (typeof window === "undefined") return NOT_READY;
  const next = compute();
  const prev = snapshot;
  if (
    prev.ready === next.ready &&
    prev.standalone === next.standalone &&
    prev.dismissed === next.dismissed &&
    prev.desktop === next.desktop &&
    prev.canPrompt === next.canPrompt &&
    prev.ios === next.ios
  ) {
    return prev;
  }
  snapshot = next;
  return next;
}

function refresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

/*
  Bind the page-level events once, at module scope, rather than in an effect.
  `beforeinstallprompt` can fire before a component has mounted, and a missed
  event means the app falls back to written instructions on a browser that
  would have shown a one-tap prompt.
*/
if (typeof window !== "undefined" && !listenersBound) {
  listenersBound = true;

  /*
    Chrome will not fire `beforeinstallprompt` unless a service worker with a
    fetch handler sits behind the manifest, so the worker is registered as soon
    as this module loads — on the landing page as well as in the app. It is a
    pass-through (see `public/sw.js`); registering it early is what makes the
    "Install Pocket" offer in the entry dialog a real one-tap prompt instead of
    a page of instructions.
  */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is an enhancement; the app works without it */
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    // Chrome shows its own mini-infobar unless the default is prevented. We
    // want the install offered at a moment we choose, inside the gate.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    refresh();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    dismissInstallGate();
  });

  // Someone may install from the browser's own UI while the tab is open.
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", refresh);
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, readSnapshot, () => NOT_READY);

  /** Trigger Chrome's install prompt. Returns true if the person accepted. */
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    const prompt = deferredPrompt;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    // The event can only be used once, whatever the answer.
    deferredPrompt = null;
    if (choice.outcome === "accepted") dismissInstallGate();
    refresh();
    return choice.outcome === "accepted";
  }, []);

  const dismiss = useCallback(() => dismissInstallGate(), []);

  return { ...state, install, dismiss };
}
