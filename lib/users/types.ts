import type { ChainKey } from "@prisma/client";

/** Client-safe view of a Pocket user (balances as decimal strings). */
export type PocketUser = {
  id: string;
  username: string;
  walletAddress: string;
  xHandle: string | null;
  telegramHandle: string | null;
  preferredChain: ChainKey;
  availableBalance: string;
  frozenBalance: string;
  createdAt: string;
};
