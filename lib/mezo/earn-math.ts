/** Mirrors MUSDSavingsRate._updateYieldFor; every value is integer wei. */
export function accruedYield(
  shares: bigint,
  stored: bigint,
  globalIndex: bigint,
  userIndex: bigint,
): bigint {
  if (shares < 0n || stored < 0n || userIndex < 0n || globalIndex < userIndex) {
    throw new Error("Invalid Savings yield accounting");
  }
  return stored + (shares * (globalIndex - userIndex)) / 10n ** 18n;
}

export function claimPayout(
  total: bigint,
  isGauge: boolean,
  cap: bigint,
): bigint {
  return isGauge && cap > 0n && total > cap ? cap : total;
}
