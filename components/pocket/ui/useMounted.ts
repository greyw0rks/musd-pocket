"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the first client paint, true from then on.
 *
 * Anything derived from the current clock — "42m ago", a formatted time —
 * differs between the server render and the client's first paint, which React
 * reports as a hydration mismatch. Gating on this makes the first paint agree
 * with the server and lets the times arrive a tick later.
 *
 * A hook rather than the same two lines copied into every screen, because the
 * rule is easy to forget and forgetting it fails loudly in the console and
 * silently on screen.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
