/** A deliberate new round reopens eligibility while preserving old receipts. */
export const FAUCET_ROUND = "btc-0.06-v2";
export const LEGACY_FAUCET_ROUND = "legacy-0.015";
export const FAUCET_BTC = "0.06";
export const FAUCET_MUSD = "300";
export const FAUCET_AMOUNTS = { btc: FAUCET_BTC, musd: FAUCET_MUSD } as const;

export function faucetClaimKey(userId: string) {
  return { userId_round: { userId, round: FAUCET_ROUND } };
}
