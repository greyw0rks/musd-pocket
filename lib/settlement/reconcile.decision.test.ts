import assert from "node:assert/strict";
import {
  decide,
  DEFAULT_GRACE_MS,
  type ChainTruth,
  type Evidence,
  type ReceiptTruth,
} from "./reconcile.decision.ts";

/**
 * The reconciler's safety properties, proven without a chain or a database.
 *
 * The one that matters most is the first group: everything that could have
 * moved money, and was not positively proven not to have, must come back
 * `hold`. A refund is the only irreversible mistake available here — it hands
 * over funds that may already be gone — so the bias is deliberately one-sided.
 */

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

/** Old enough that the grace window no longer protects it. */
const OLD = DEFAULT_GRACE_MS + 60_000;

const ev = (over: Partial<Evidence> = {}): Evidence => ({
  chain: { state: "not-released" },
  receipt: null,
  ageMs: OLD,
  relayerIdle: true,
  graceMs: DEFAULT_GRACE_MS,
  ...over,
});

const kind = (e: Evidence) => decide(e).kind;
const r = (state: ReceiptTruth["state"]): ReceiptTruth => ({ state });
const c = (state: ChainTruth["state"]): ChainTruth => ({ state });

console.log("\nnever refund on evidence we failed to gather");

check("chain unreadable holds, even with no hash and an idle relayer", () => {
  assert.equal(kind(ev({ chain: c("unknown") })), "hold");
});

check("chain unreadable holds even when a reverted receipt was seen", () => {
  // Contradictory evidence is not a tie to be broken — it is a reason to stop.
  assert.equal(kind(ev({ chain: c("unknown"), receipt: r("reverted") })), "hold");
});

check("RPC timeout on the receipt lookup holds", () => {
  assert.equal(kind(ev({ receipt: r("unknown") })), "hold");
});

check("a hash we hold but cannot resolve never refunds", () => {
  assert.equal(kind(ev({ receipt: r("not-found") })), "hold");
});

check("a hash we hold but cannot resolve holds even past the grace window", () => {
  // The guard here is that the hash exists at all: "not found" from a node can
  // mean "not yet", and a mempool transaction still has time to land.
  assert.equal(kind(ev({ receipt: r("not-found"), ageMs: OLD * 100 })), "hold");
});

console.log("\nfinalize — the money moved, so nothing may refund");

check("successful receipt finalizes", () => {
  assert.equal(kind(ev({ receipt: r("success") })), "finalize");
});

check("processed=true on-chain finalizes", () => {
  assert.equal(kind(ev({ chain: c("released") })), "finalize");
});

check("successful receipt finalizes without consulting the chain flag", () => {
  // The payout-confirmed-but-DB-write-failed case. It must finalize even when
  // the flag read failed, or the row would be retried forever.
  assert.equal(kind(ev({ receipt: r("success"), chain: c("unknown") })), "finalize");
});

check("successful receipt finalizes even if the chain says not-released", () => {
  // Only releases are ever broadcast, so a success is proof. Refusing to
  // finalize here would strand funds that are provably already delivered.
  assert.equal(
    kind(ev({ receipt: r("success"), chain: c("not-released"), ageMs: 0 })),
    "finalize",
  );
});

check("released on-chain finalizes even with a stale reverted receipt", () => {
  assert.equal(kind(ev({ chain: c("released"), receipt: r("reverted") })), "finalize");
});

console.log("\nrefund — only on positive proof that nothing moved");

check("reverted receipt refunds", () => {
  assert.equal(kind(ev({ receipt: r("reverted") })), "refund");
});

check("no hash + past grace + idle relayer refunds", () => {
  assert.equal(kind(ev()), "refund");
});

console.log("\nholds on timing and on a busy relayer");

check("inside the grace window holds", () => {
  assert.equal(kind(ev({ ageMs: 1_000 })), "hold");
});

check("one millisecond before the boundary is still too early", () => {
  assert.equal(kind(ev({ ageMs: DEFAULT_GRACE_MS - 1 })), "hold");
});

check("no hash, past grace, relayer busy holds", () => {
  // Our own transaction may be one of the ones in flight.
  assert.equal(kind(ev({ relayerIdle: false })), "hold");
});

check("no hash, past grace, relayer state unknown holds", () => {
  assert.equal(kind(ev({ relayerIdle: null })), "hold");
});

console.log("\ndecisions are total");

check("every verdict is one of the three outcomes and explains itself", () => {
  const chains: ChainTruth[] = [c("released"), c("not-released"), c("unknown")];
  const receipts = [null, r("success"), r("reverted"), r("not-found"), r("unknown")];
  for (const chain of chains) {
    for (const receipt of receipts) {
      for (const ageMs of [0, OLD]) {
        for (const relayerIdle of [true, false, null]) {
          const v = decide({ chain, receipt, ageMs, relayerIdle, graceMs: DEFAULT_GRACE_MS });
          assert.ok(["finalize", "refund", "hold"].includes(v.kind));
          assert.ok(v.why.length > 0);
        }
      }
    }
  }
});

check("an unreadable chain can never produce a refund", () => {
  // The invariant, stated directly: a refund requires the chain to have been
  // read and to have positively said "not released".
  const receipts = [null, r("success"), r("reverted"), r("not-found"), r("unknown")];
  for (const receipt of receipts) {
    const e: Evidence = {
      chain: c("unknown"),
      receipt,
      ageMs: OLD,
      relayerIdle: true,
      graceMs: DEFAULT_GRACE_MS,
    };
    assert.notEqual(decide(e).kind, "refund");
  }
});

console.log(`\n${passed} passed\n`);
