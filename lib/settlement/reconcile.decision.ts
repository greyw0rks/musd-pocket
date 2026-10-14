/**
 * The reconciliation verdict — pure, so it can be exercised without a chain, a
 * database or a relayer key. `lib/settlement/reconcile.ts` gathers the evidence
 * and acts on what this returns; nothing here touches the world.
 *
 * THE GOVERNING RULE: a refund is never permitted on the strength of our own
 * missing data. A missing transaction hash, a timed-out RPC call or a row that
 * merely looks stale is NOT evidence that no funds moved — a process can die
 * between broadcasting a payout and writing its hash down, and from the
 * database alone that is indistinguishable from a payout that was never sent.
 * Only the chain can settle it.
 *
 * The chain settles it through the vault's `processed[paymentId]` flag.
 * `PocketVault._release` sets that flag BEFORE the token transfer
 * (checks-effects-interactions, contracts/src/PocketVault.sol:94), so a revert
 * rolls the flag back along with the transfer. The flag is therefore exactly
 * equivalent to "this release succeeded" — authoritative in both directions:
 * set means the money moved, unset means it did not.
 *
 * Note what the flag does NOT carry: no recipient and no amount, just a
 * boolean. A hash we lost can be recovered from the `Payout`/`Withdraw` events
 * instead (both index `paymentId`), which is why `finalize` does not depend on
 * having kept the hash.
 */

/** What the vault contract says about this paymentId. */
export type ChainTruth =
  | { state: "released" } // `processed[paymentId]` is true — the money moved
  | { state: "not-released" } // the contract has no record of a release
  | { state: "unknown" }; // the chain could not be read

/** What the node says about the transaction we broadcast. */
export type ReceiptTruth =
  | { state: "success" }
  | { state: "reverted" }
  | { state: "not-found" } // the node does not know this hash
  | { state: "unknown" }; // the lookup itself failed

export type Evidence = {
  chain: ChainTruth;
  /** Null when we have no hash to look up at all. */
  receipt: ReceiptTruth | null;
  ageMs: number;
  /** Whether the relayer has any transaction in flight. Null if not established. */
  relayerIdle: boolean | null;
  graceMs: number;
};

export type Verdict =
  | { kind: "finalize"; why: string }
  | { kind: "refund"; why: string }
  | { kind: "hold"; why: string };

/**
 * How long an attempt must be silent before its absence from the chain counts
 * as proof it never happened. A broadcast that is going to mine will mine well
 * inside this; the window exists so a transaction still sitting in the mempool
 * is never mistaken for one that was never sent.
 */
export const DEFAULT_GRACE_MS = 15 * 60_000;

export function decide(e: Evidence): Verdict {
  // 1. A successful receipt for a transaction we broadcast is proof on its own.
  //    The only calls this server ever sends to the vault are releases, so a
  //    success means the release executed. Nothing below may convert this into
  //    a refund — that is the "payout confirmed on-chain but the DB write
  //    failed" case, and it is the one that must never pay out twice.
  if (e.receipt?.state === "success") {
    return { kind: "finalize", why: "receipt succeeded — the release executed" };
  }

  // 2. The contract's own record, which is authoritative in both directions.
  if (e.chain.state === "released") {
    return { kind: "finalize", why: "vault marked this paymentId processed" };
  }

  // 3. The chain could not be read. We have established nothing, so we change
  //    nothing and try again later. This is the RPC-failure case.
  if (e.chain.state === "unknown") {
    return { kind: "hold", why: "chain unreadable — outcome not established" };
  }

  // From here the contract positively says "no release" for this paymentId.
  //
  // 4. A reverted receipt corroborates it from the other side: the transaction
  //    ran, and it failed. Nothing moved, so the funds are the user's.
  if (e.receipt?.state === "reverted") {
    return {
      kind: "refund",
      why: "receipt reverted and the contract recorded no release",
    };
  }

  // 5. We hold a hash but cannot resolve it. It may still be in the mempool, so
  //    "not released yet" is not "never released". Leave it alone; a stuck
  //    transaction is an operator problem, not grounds for handing money back.
  if (e.receipt?.state === "not-found" || e.receipt?.state === "unknown") {
    return {
      kind: "hold",
      why: "hash known but its outcome is undetermined",
    };
  }

  // 6. No hash at all. Either the process died before broadcasting, or it
  //    broadcast and lost the hash. Time and an idle relayer separate those.
  if (e.ageMs < e.graceMs) {
    return { kind: "hold", why: "inside the grace window" };
  }
  if (e.relayerIdle !== true) {
    return {
      kind: "hold",
      why: "relayer has transactions in flight, so one of ours may still land",
    };
  }

  return {
    kind: "refund",
    why: "no on-chain release recorded after the grace window, and the relayer is idle",
  };
}
