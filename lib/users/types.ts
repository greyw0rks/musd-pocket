import type { ChainKey } from "@prisma/client";

/** Client-safe view of a Pocket user (balances as decimal strings). */
export type PocketUser = {
  id: string;
  username: string;
  walletAddress: string;
  xHandle: string | null;
  /** X profile picture, hot-linked; absent for Telegram/email accounts. */
  avatarUrl: string | null;
  /** Where payment receipts are emailed; null until the user adds one. */
  receiptsEmail: string | null;
  telegramHandle: string | null;
  preferredChain: ChainKey;
  availableBalance: string;
  frozenBalance: string;
  createdAt: string;
};
