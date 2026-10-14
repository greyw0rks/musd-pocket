/**
 * Vault domain types.
 *
 * A vault goal is money the user has deliberately set aside, with a target to
 * measure it against. It is separate from the payment domain because it is not
 * a payment: nothing leaves the wallet, and the ledger has no entry for it.
 *
 * Note the name collision to watch for: `lib/mezo/vault.ts` and
 * `contracts/src/PocketVault.sol` are the *settlement* vault — the on-chain
 * float that moves MUSD between users. A goal in this file is the opposite
 * idea, money that does not move. They are unrelated, and nothing in the
 * savings UI should reach for the settlement ABI by mistake.
 *
 * These shapes exist before anything fills them. The screen renders from them
 * today with an empty list, and the Mezo adapter will supply them once
 * saving is wired — the screen does not change shape to accommodate that.
 */

export interface VaultGoal {
  id: string;
  /** What the money is for, in the user's words. */
  name: string;
  /** Set aside so far, in minor units. */
  savedUnits: bigint;
  /** What the goal is aiming at, in minor units. */
  targetUnits: bigint;
}
