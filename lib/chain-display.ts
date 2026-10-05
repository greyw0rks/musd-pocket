import type { ChainKey } from "@prisma/client";

/**
 * Client-safe chain labels. Deliberately avoids importing the `@prisma/client`
 * runtime (as `lib/chains.ts` does) so UI components can label a chain without
 * pulling Prisma into the browser bundle.
 */
export const CHAIN_LABELS: Record<ChainKey, string> = {
  MEZO: "Mezo",
  BASE: "Base",
  ETHEREUM: "Ethereum",
};

export function chainLabel(key: ChainKey): string {
  return CHAIN_LABELS[key];
}
