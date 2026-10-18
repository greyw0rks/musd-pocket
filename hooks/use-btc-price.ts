"use client";

import { useEffect, useState } from "react";

/**
 * The BTC spot price, in micro-dollars, or `null` until one has been read.
 *
 * `null` is the whole reason this is nullable, and it means two things the card
 * has to render the same way but that are worth keeping straight here: no price
 * has arrived *yet*, and no price could be had. Either way the answer is not
 * zero — a zero would erase the user's BTC from a total that claims to be
 * everything they hold — so a caller that gets `null` leaves the holding
 * unpriced and says so. See `BalanceCards`.
 *
 * `/api/price/btc` is public and unauthenticated on purpose: the price is the
 * same for everyone, and Home should be able to show a total in the moment
 * before the session finishes loading rather than waiting on a token to fetch a
 * number that has nothing to do with who is asking.
 *
 * Refreshed on the route's own cadence. It is a cheap call after the first one —
 * the CDN answers it — and it is the difference between the ≈ figures under the
 * holdings being a spot price and being whatever BTC cost when the tab opened.
 */
const REFRESH_MS = 60_000;

export function useBtcPrice(): bigint | null {
  const [usdMicros, setUsdMicros] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      try {
        const res = await fetch("/api/price/btc");
        /*
          Any non-OK is "no price": the route answers 503 when every source
          failed, and a 5xx or a proxy error is the same fact arriving a
          different way. Nothing here distinguishes them because the response
          is the same either way — the holding stays unpriced.
        */
        if (!res.ok) return;

        const body = (await res.json()) as { usdMicros?: unknown };
        if (typeof body.usdMicros !== "string") return;

        if (!cancelled) setUsdMicros(BigInt(body.usdMicros));
      } catch {
        /*
          A failed refresh keeps the reading already on screen. A price from a
          minute ago is a price; the alternative — dropping back to `null` —
          would make a flaky network blink the user's BTC out of their total.
          Only a *first* read that fails leaves this `null`, which is correct:
          nothing has been priced yet.
        */
      }
    }

    read();
    const timer = setInterval(read, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return usdMicros;
}
