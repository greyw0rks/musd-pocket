/**
 * Display copy for the marketing surface.
 *
 * The canonical token ticker lives in `lib/mezo/config.ts` as `MUSD_SYMBOL`.
 * That module imports `viem/chains`, so importing it from a `"use client"`
 * component would drag viem into the landing page's browser bundle — which the
 * whole point of this page's architecture is to avoid. Keep these in sync.
 */
export const TICKER = "mUSD";
export const NETWORK = "Mezo";
