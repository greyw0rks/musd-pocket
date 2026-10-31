/** Historical settlement stays opt-in while outstanding rows are classified. */
export function legacySettlementEnabled() {
  return process.env.POCKET_ENABLE_LEGACY_SETTLEMENT === "true";
}
