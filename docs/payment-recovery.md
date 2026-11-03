# Direct payment recovery

Ordinary Send and invoice checkout now share the same direct mUSD transfer
verifier. The authenticated sender, token, recipient, exact amount, transaction
calldata, successful receipt, and Transfer event must agree before confirmation.
Inputs use decimal strings (up to 20 whole and 18 fractional digits); Activity
retains the exact amount.

## Recording and recovery

`POST /api/payments/record` files only matching transfers as `DIRECT`. Unknown
hashes return pending without reserving an ID. Readable matching transfers may
be filed as pending; retries verify them again. A confirmed revert becomes
failed and never changes ledger balances. An existing or concurrently created
record must match the same sender, recipient, amount, token, chain, and hash
before an idempotent reply or guarded update is permitted.

The client stores each returned transaction hash before waiting for a receipt
or recording it. Records are scoped by wallet and chain. If recording or the
RPC is unavailable, a pending item remains in Activity, including after reload.
The same pending payment retries its hash rather than signing again. A transfer
screen attempt key and browser Web Locks also protect repeated submissions.
Site storage must be writable before a new send starts.

Activity refresh retries local hashes, calls the authenticated
`POST /api/payments/recover` for the caller's pending records, and reads the
server's history. Matching server rows replace local placeholders. A pending
receipt offers **Check confirmation** and hides **Send again**. Failed balance
refreshes do not discard a payment receipt. Recorded chain IDs provide the
network label and explorer link; older rows lacking the ID say so.

The authenticated cron independently recovers direct transfers even without a
configured PocketVault. Its response contains separate `direct` and `legacy`
reports. No transfer is signed by recording, recovery, or Activity refresh.

## Existing payments

Only `LEGACY_VAULT` payments enter the vault/ledger reconciler. The legacy send
endpoint now writes that mode explicitly. `DIRECT` and `UNCLASSIFIED` rows are
excluded by both the selection query and the per-row guard. Ledger status
updates also require `LEGACY_VAULT`.

Historical `UNCLASSIFIED` records are not automatically reclassified. Review
their original ledger entries and on-chain evidence before assigning a mode.
They remain visible in Activity; attempts to reuse them through the direct
record endpoint return a conflict. This prevents a direct transaction from
releasing or refunding unrelated frozen ledger funds. No live records were
modified as part of this implementation, and no schema migration is required:
the mode/network/token columns already exist in the configured database.

## Validation and limits

```sh
pnpm test:payments
pnpm test:checkout
pnpm test:reconcile
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm build
node scripts/check-checkout-browser.mjs
```

Tests mock the wallet, database, and RPC. They exercise pending-to-paid recovery,
wrong ownership, concurrent conflicts, reloads, duplicate submits, storage
failure, receipt UI, and ledger isolation. They do not send live funds.

Confirmation uses one successful receipt; reorg monitoring and replacement
transaction discovery remain future work. Clearing site storage removes local
hashes that were never filed on the server. A wallet error before returning a
hash can be ambiguous: check the wallet's activity before sending again. These
client guards do not make ERC-20 transfers globally idempotent across devices.
