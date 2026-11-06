import type { ChainKey } from "@prisma/client";
import type { ReceiptsLink } from "@/features/session/session.types";

/** Client-safe view of a Pocket user (balances as decimal strings). */
export type PocketUser = {
  id: string;
  username: string;
  role: "PERSONAL" | "MERCHANT";
  businessName: string | null;
  walletAddress: string;
  xHandle: string | null;
  /** X profile picture, hot-linked; absent for Telegram/email accounts. */
  avatarUrl: string | null;
  telegramHandle: string | null;
  preferredChain: ChainKey;
  availableBalance: string;
  frozenBalance: string;
  createdAt: string;
  /** Returned only on the authenticated account endpoint. */
  receipts?: ReceiptsLink | null;
};
