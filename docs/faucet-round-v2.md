# Faucet round: 0.06 BTC

Each authenticated Pocket account can claim **0.06 testnet BTC and 300 mUSD**
once in round `btc-0.06-v2`, including accounts that claimed the original faucet.
Old claims and their transaction receipts remain in round `legacy-0.015`.
The separate MEZO welcome reward keeps its existing eligibility.

The API and UI share one reward policy. Claim records are unique per account
and round. The UI cache is also scoped to the account and round, so an old
"claimed" response cannot hide the new allowance. Claims retain the existing
lease and transaction-hash recovery to prevent duplicate payouts.

Before deploying this API, apply only
`prisma/sql/2026-10-31-faucet-round-v2.sql` to the Pocket database:

```sh
pnpm exec prisma db execute \
  --file prisma/sql/2026-10-31-faucet-round-v2.sql \
  --schema prisma/schema.prisma
```

The migration labels existing claims and changes the unique index without
deleting any records. It is safe to repeat. Do not use `db push` against the
live database, which has unrelated legacy schema drift. Do not rerun the old
faucet bootstrap SQL after this migration.

The funding wallet needs at least **0.0605 BTC** (allowance plus gas reserve)
and **300 mUSD** to cover a completely new claim. Insufficient inventory keeps
the claim available for a later retry and sends no funds.

To run the faucet regression checks:

```sh
pnpm exec vitest run --config vitest.faucet.config.ts
```

These tests cover old-user eligibility, the full new allowance, repeat claims,
partial-claim recovery, concurrent requests, gas reserve and receipt timeouts.
