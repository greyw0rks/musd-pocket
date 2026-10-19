/**
 * The faucet's wire shape.
 *
 * Kept out of `lib/faucet` (which is server-only) so the client hook can name
 * the same response the route sends without importing the signer.
 */
export type FaucetClaimView = {
  btcTxHash: string | null;
  musdTxHash: string | null;
  completedAt: string | null;
  error: string | null;
};

export type FaucetStatusView = {
  /** False on mainnet, where the faucet does not exist and the icon is hidden. */
  enabled: boolean;
  /**
   * True once the claim has been used — including the gap between broadcast
   * and confirmation, so a reload cannot offer a second claim to a user whose
   * first one is still landing.
   */
  claimed: boolean;
  /** Broadcast but not yet confirmed by both receipts. */
  pending: boolean;
  /**
   * Whether the funding wallet can cover the legs still outstanding.
   * `null` = the chain could not be read, so the sheet allows the attempt and
   * lets the claim endpoint give the authoritative answer.
   */
  funded: boolean | null;
  claim: FaucetClaimView | null;
  amounts: { btc: string; musd: string };
};
