# Mezo features — 13 November 2026

Working app: `musd-pocket`. `musd-pocket-wave1` remains reference material.

## Implemented

- **Savings:** shares remain 1:1 principal. Claimable yield includes stored yield plus the user's share of the global yield-index change, with the gauge cap applied only to the gauge. Reads use one block. Failed reads stay unknown. Claim simulation must return a positive payout before signing. Gas, price and nonce are prepared before wallet confirmation. A lost wallet response retains a hash or nonce reservation; confirmation checks recover the actual payout. Explicit retries reuse the original nonce, and a claim that has already finished is recovered first.
- **Merchant profile:** Profile → Payment profile saves Personal/Business and a business name through the authenticated user API. The session reads these fields back. New payment links prefill the business name, with a server-side fallback; each invoice keeps its own name snapshot. Payments still go to the authenticated creator's wallet. A profile save failure is shown as a failure.
- **Navigation:** the dock is **Home · Swap · Wealth**. Payment history remains under Home → View All (and the transaction menu).
- **Swap:** exchange mUSD and BTC, mUSDC or mUSDT in either direction through a verified testnet pool. Review exact input, estimated output, minimum received, pool fee, slippage and wallet recipient. Empty or paused pairs cannot be swapped. Every swap uses `swapExactTokensForTokens` with a nonzero minimum and a five-minute deadline.
- **Wealth:** Vault, Lock and Pools are managed in Pocket. Vault retains deposit/withdraw/claim flows. New locks use BTC and support creation, top-up, extension, expired withdrawal and permanent-lock controls. The deployed veBTC testnet maximum is 30 days with weekly rounding. The Existing MEZO tab preserves lifecycle controls for previous positions. Ownership and eligibility are checked again before signing. Pools support adding/removing liquidity and claiming pool fees for mUSD/BTC, mUSD/mUSDC and mUSD/mUSDT. New swap, pool and lock actions are testnet-only.
- **Weekly tasks:** the checklist is available immediately. Confirmed activity and qualifying referrals count toward sending, invites, borrowing, repayment, liquidity, swaps and BTC locks. Tasks reset weekly and do not promise a token payout.
- **Welcome retirement:** the faucet supplies starting funds. POST `/api/rewards/welcome` returns HTTP 410 and issues no new authorization or reward. Authenticated GET retains recovery for existing claims; previous user-owned MEZO NFTs remain accessible through Existing MEZO.

## Live evidence

The read-only report at block **16,525,137** found 2,000 sMUSD principal, zero current claimable yield, and a Trove closed by its owner with zero debt. Wallet state changes over time; use a fresh quote before any transaction.

Two existing successful claims were independently verified against transaction calldata, receipts and mUSD Transfer logs:

| Transaction                                                                                                             |       mUSD received |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------: |
| [0x43149c…08cfdf](https://explorer.test.mezo.org/tx/0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf) | 187.366117347141378 |
| [0x527173…b7a3af](https://explorer.test.mezo.org/tx/0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af) |    0.00228183663115 |

These were existing Savings transactions, verified on November 2. On November 3 the user completed the approved open/10-mUSD-repay/close sequence. [Repayment proof](evidence/wave-2-repayment-proof.json) accounts for interest accrual and matches protocol storage/events and the exact burn. [Lifecycle proof](evidence/wave-2-borrow-lifecycle.json) verifies 0.05 BTC returned and final debt zero.

Evidence: [readiness](evidence/mezo-wealth-readiness.json), [verified receipts](evidence/mezo-feature-receipts.json). Regenerate with `node --env-file=.env --import tsx scripts/check-mezo-wealth.ts` and `scripts/check-mezo-feature-receipts.ts` respectively. Both are read-only.

## In-app transaction behavior

- Users sign with their own active Pocket wallet. The server relayer is not used for swaps, pools or personal lock actions. The wallet, session address and network must agree.
- Approvals are exact amounts, with an explicit zero-reset step when a token has an insufficient existing allowance. Each approval and final action requires a separate confirmation. Estimates are simulated before signing, and BTC must remain available for gas.
- Pool and swap reviews support 0.1%, 0.5% or 1% slippage. Contract, token decimals, factory and pool identity are verified. The second deposit amount follows the pool ratio and remains editable; unused tokens stay in the wallet. An empty pool's first provider sets the starting price. Stable pools require equal normalized initial amounts and a minimum initial invariant.
- Lock unlock dates round down to a weekly boundary. A permanent lock has no scheduled withdrawal; starting a BTC unlock sets a date up to 30 days away. Previous MEZO permanent locks retain their 208-week countdown. Unreleased managed positions, assigned votes where withdrawal/unlock is restricted, and unvested grant top-ups are rejected. The escrow token, implementation and stored maximum duration are checked before quoting.
- A pending transaction is saved per wallet and chain before asking the wallet, then updated with its hash. Receipt checks verify sender, destination, calldata and value, without another signature. Unknown wallet submission outcomes block new actions; the user can clear an unsent request only after explicitly confirming their wallet history shows it was never sent. Clearing the record cannot cancel a sent transaction. Browser storage persists recovery across reloads when available; a memory fallback only lasts for the current page.
- Supported pool actions are direct liquidity and fee claims. Gauge staking, voting and releasing managed locks are not integrated.

The [unsigned in-app readiness report](evidence/inapp-wealth-readiness.json) captured deployed pool/token identities and available quotes. Its older MEZO-lock snapshot and wallet balances are historical. [Current BTC lock readiness](evidence/btc-lock-readiness-2026-11-12.json) checks veBTC and the native BTC precompile without signing. Paired liquidity deposits need both assets; quotes and funding availability change over time.

## Historical welcome campaign — 3 November 2026

The approved 20-MEZO campaign is `0xa78709beb3841aac1ed8fc3d8dedf74d55f62432`, funded with 100 testnet MEZO. Deployment and funding receipts, verified configuration and gas costs are in [the activation evidence](evidence/wave-2-welcome-deployment.json). The first claim is [verified](evidence/wave-2-welcome-claim.json): recipient-owned NFT #941, 20 MEZO, November 12 expiry, matching journal/event and an `AlreadyClaimed` replay simulation. The November 3 snapshot recorded 80 MEZO remaining. This release retires new reward requests.

The earlier campaign at `0x3469818359ce1bae2d137531dcd78c5cc4ec14ba` pays 200 MEZO and is empty. It is not the new campaign; prior users' NFTs remain theirs. The builder approved a new 20-MEZO campaign and another claim opportunity for prior recipients. Do not repeat deployment/funding from the evidence; the operator journal preserves both hashes.

The reviewed [additive SQL](../prisma/sql/2026-11-02-merchant-and-rewards.sql) was applied on November 3 and preserves the reward journal. The current UI uses the faucet and weekly tasks. Historical deployment/funding scripts and evidence are retained for reproducibility; they are not activation steps for a new campaign.

Operational limit: a `SENDING` reservation with no hash must be checked against the relayer nonce/history and on-chain `claims` mapping before manual recovery. Never automatically expire it or enable blind retries. A missing journal table or unavailable database stops claims. The shared relayer uses an in-process nonce manager; multi-instance operation with other relayer jobs needs coordinated nonce management or a dedicated serialized reward worker before campaign rollout.

## Remaining verification

- **User/merchant testing:** the user will contact testers. No outreach or adoption claims were made. Use [the testing guide](mezo-testing-guide.md).
- **Submission:** verify the official Wave 2 rules/deadline, attach current demo/customer evidence and retain submission confirmation. [Delivery status](submission/delivery.md).

## Checks

- `pnpm test:wealth`: Savings accounting/recovery, authenticated merchant updates/name snapshots, reward configuration/recovery/reservations, owned lock enumeration, swap/pool quote protections, lock lifecycle rules, wallet identity and pending-transaction recovery.
- `node --env-file=.env --import tsx scripts/check-btc-locks.ts`: read-only veBTC/veMEZO configuration, BTC precompile balance and position decoding.
- `MEZO_BTC_LOCK_FORK_RPC=https://rpc.test.mezo.org forge test --match-contract PocketBTCLockForkTest -vv` in `contracts`: two local tests of deployed veBTC create/top-up/extend/withdraw and permanent unlock. The BTC precompile is replaced by an ERC-20 fixture; this creates no live BTC lock.
- `pnpm test:checkout`, `pnpm test:payments`, `pnpm test:reconcile`: payment regressions.
- `forge test --match-contract '^PocketWelcomeRewardTest$'` in `contracts`: 14 contract tests including signature replay, ownership, expiry and rollback; fuzzing covers weekly rounding.
- `forge test --match-contract PocketWelcomeRewardForkTest` with `MEZO_REWARD_FORK_RPC`: local fork of deployed veMEZO. The Cosmos MEZO precompile is replaced by a mintable EVM fixture; this is not proof of a real token transfer or a live campaign.
- `MEZO_POOL_FORK_RPC=https://rpc.test.mezo.org forge test --match-contract PocketWealthForkTest --gas-limit 100000000 -vv` in `contracts`: five local-fork tests at block 16,525,761. Exercises deployed router/pool/escrow code for liquidity deposits/removals, swaps in both directions, slippage refusal, pool fee claims, lock creation/top-up/extension/withdrawal and permanent unlock. Tokens (including Cosmos precompiles) are EVM fixtures, so this does not prove live token transfers. The multi-operation tests use a raised test gas budget; the four-year scenario advances through periodic checkpoints to model continuing chain activity.
- `node scripts/check-wealth-browser.mjs`: mobile components and real client transaction controllers against explicit RPC/wallet fixtures. Checks Home/Swap/Wealth navigation, swap/lock/pool controls, separate approval/final confirmations, pending recovery without signing, uncertain submission handling, mobile button visibility and merchant save failure/success. It does not authenticate or write to the real backend.
- `node scripts/check-checkout-browser.mjs`: actual local app, anonymous authentication/checkout smoke checks.

Current validation is recorded in [Android 0.2.5 evidence](evidence/android/validation-0.2.5.json). It covers finance/backend tests, BTC lifecycle forks, claim recovery controls, screen layouts, focused ESLint, TypeScript, the production build and the signed Android bundle. Physical device/account flows remain unverified.

The earlier payment work passed 59 checkout tests, 39 payment tests, 18 reconciliation assertions, 14 welcome-reward contract tests and one reward local-fork test. That November 2 work executed no live financial transaction or database migration. The November 3 activation applied the additive journal SQL and executed the builder-approved campaign deployment and 100-MEZO funding. Local-fork and browser fixture tests are not evidence of live wallet signatures.
