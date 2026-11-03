export type WelcomeRewardStatus = {
  enabled: boolean;
  state: "unavailable" | "available" | "claimed" | "wallet-claimed";
  reason: string | null;
  chainId: number;
  campaignAddress: string | null;
  escrowAddress: string | null;
  rewardAmount: string | null;
  lockWeeks: number | null;
  /** Preview before claiming, receipt-backed expiry afterwards. */
  unlockAt: string | null;
  claim: {
    recipient: string;
    tokenId: string;
    amount: string;
    unlockAt: string;
  } | null;
  /** A broadcast is pending until the on-chain claim record exists. */
  pendingTxHash?: string;
  pendingStatus?: "pending" | "reverted";
};
