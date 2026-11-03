# Mezo features — 2 November 2026

Working app: `musd-pocket`. `musd-pocket-wave1` remains reference material.

## Implemented

- **Savings:** shares remain 1:1 principal. Claimable yield includes stored yield plus the user's share of the global yield-index change, with the gauge cap applied only to the gauge. Reads use one block. Failed reads stay unknown. Claim simulation must return a positive payout before signing. Broadcast hashes survive refresh; checking a pending claim verifies sender, destination and calldata and does not sign again.
- **Merchant profile:** Profile → Payment profile saves Personal/Business and a business name through the authenticated user API. The session reads these fields back. New payment links prefill the business name, with a server-side fallback; each invoice keeps its own name snapshot. Payments still go to the authenticated creator's wallet. A profile save failure is shown as a failure.
- **Navigation:** the dock is **Home · Swap · Wealth**. Payment history remains under Home → View All (and the transaction menu).
- **Swap:** exchange mUSD and BTC, mUSDC or mUSDT in either direction through a verified testnet pool. Review exact input, estimated output, minimum received, pool fee, slippage and wallet recipient. Empty or paused pairs cannot be swapped. Every swap uses `swapExactTokensForTokens` with a nonzero minimum and a five-minute deadline.
- **Wealth:** Vault, Lock and Pools are managed in Pocket. Vault retains deposit/withdraw/claim flows. Locks support creation, adding MEZO, extending, withdrawing expired positions, making a lock permanent, and starting a permanent lock's 208-week countdown. Ownership and eligibility are checked again before signing. Pools support adding/removing liquidity and claiming pool fees for mUSD/BTC, mUSD/mUSDC and mUSD/mUSDT. Explorer links are only for receipts; no action sends users to an external management page. New swap, pool and lock actions are testnet-only.
- **Welcome rewards:** server API, UI, EIP-712 authorization and Solidity campaign for 20 testnet MEZO per account and wallet, locked into a user-owned veMEZO NFT for two weekly epochs (7–14 days after weekly rounding). Claims check chain, token, escrow, amount, duration, inventory, authorizer and relayer gas. Receipt-backed claims remain visible when a campaign is paused or empty.
- **Recovery:** a database reservation prevents concurrent or repeated reward sends, including across server restarts. Known hashes are retained in the database and browser. Only a verified revert makes a broadcast retryable. An ambiguous submission without a hash remains reserved for operator investigation.

## Live evidence

The read-only report at block **16,525,137** found 2,000 sMUSD principal, zero current claimable yield, and a Trove closed by its owner with zero debt. Wallet state changes over time; use a fresh quote before any transaction.

Two existing successful claims were independently verified against transaction calldata, receipts and mUSD Transfer logs:

| Transaction                                                                                                             |       mUSD received |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------: |
| [0x43149c…08cfdf](https://explorer.test.mezo.org/tx/0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf) | 187.366117347141378 |
| [0x527173…b7a3af](https://explorer.test.mezo.org/tx/0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af) |    0.00228183663115 |

These were existing transactions, **not broadcasts by this work**. The explorer returned all 26 indexed outgoing transactions and no `repayMUSD` transaction. No new loan, claim, deployment or funding transfer was signed here.

Evidence: [readiness](evidence/mezo-wealth-readiness.json), [verified receipts](evidence/mezo-feature-receipts.json). Regenerate with `node --env-file=.env --import tsx scripts/check-mezo-wealth.ts` and `scripts/check-mezo-feature-receipts.ts` respectively. Both are read-only.

## In-app transaction behavior

- Users sign with their own active Pocket wallet. The server relayer is not used for swaps, pools or personal lock actions. The wallet, session address and network must agree.
- Approvals are exact amounts, with an explicit zero-reset step when a token has an insufficient existing allowance. Each approval and final action requires a separate confirmation. Estimates are simulated before signing, and BTC must remain available for gas.
- Pool and swap reviews support 0.1%, 0.5% or 1% slippage. Contract, token decimals, factory and pool identity are verified. The second deposit amount follows the pool ratio and remains editable; unused tokens stay in the wallet. An empty pool's first provider sets the starting price. Stable pools require equal normalized initial amounts and a minimum initial invariant.
- Lock unlock dates round down to a weekly boundary. A permanent lock has no scheduled withdrawal; **Start unlock begins a new 208-week countdown**. It does not release funds immediately. Unreleased managed positions, assigned votes where withdrawal/unlock is restricted, and unvested grant top-ups are rejected. The current escrow implementation is checked before quoting so an upgrade requires a rules review.
- A pending transaction is saved per wallet and chain before asking the wallet, then updated with its hash. Receipt checks verify sender, destination, calldata and value, without another signature. Unknown wallet submission outcomes block new actions; the user can clear an unsent request only after explicitly confirming their wallet history shows it was never sent. Clearing the record cannot cancel a sent transaction. Browser storage persists recovery across reloads when available; a memory fallback only lasts for the current page.
- Supported pool actions are direct liquidity and fee claims. Gauge staking, voting and releasing managed locks are not integrated.

The [unsigned in-app readiness report](evidence/inapp-wealth-readiness.json) verifies deployed configuration, token identities, current fees and available pool/swap quotes. Run `node --env-file=.env --import tsx scripts/check-inapp-wealth.ts` to refresh it without signing. At blocks 16,526,104–16,526,108, the inspected wallet held 0.713197400311319805 mUSD/BTC LP tokens and no MEZO; creating a lock needs testnet MEZO, and each paired liquidity deposit needs both assets. The mUSD/mUSDT pool was empty. The wallet's LP balance changed while development was ongoing; this report only reads the chain and submitted no transaction. Quotes and funding availability change over time.

## Welcome campaign activated — 3 November 2026

The approved 20-MEZO campaign is `0xa78709beb3841aac1ed8fc3d8dedf74d55f62432`, funded with 100 testnet MEZO for five claims. Deployment and funding receipts, verified configuration and gas costs are in [the activation evidence](evidence/wave-2-welcome-deployment.json). Production is configured for this campaign and chain 31611. The first real pilot claim/NFT receipt remains pending.

The earlier campaign at `0x3469818359ce1bae2d137531dcd78c5cc4ec14ba` pays 200 MEZO and is empty. It is not the new campaign; prior users' NFTs remain theirs. The builder approved a new 20-MEZO campaign and another claim opportunity for prior recipients. Do not repeat deployment/funding from the evidence; the operator journal preserves both hashes.

For another environment, follow these activation steps against its actual configuration:

1. The reviewed [additive SQL](../prisma/sql/2026-11-02-merchant-and-rewards.sql) was applied on November 3: the live database now has the reward journal. `users.role` and `users.businessName` already existed; the confirmed `musd_pocket` account is configured as Business/Pocket. For other databases, review/apply this SQL instead of `prisma db push`, because unrelated live-schema drift exists.
2. Select the campaign administrator, the server relayer/authorizer, and funding budget. A proposed first batch of **10 claims needs 200 testnet MEZO**; 30 needs 600. These are proposals, not allocated funds. The server also needs testnet BTC for claim gas. Simulate the deployment and re-estimate fees at execution time.
3. Deploy `contracts/script/DeployPocketWelcomeReward.s.sol` to chain 31611 with reviewed `WELCOME_REWARD_ADMIN` and `WELCOME_REWARD_AUTHORIZER`. The script deploys only; it does not fund. The embedded user wallet is not interchangeable with the server relayer.
4. Verify `rewardToken`, `votingEscrow`, `authorizer`, `rewardAmount=20e18`, and `lockDuration=1209600`, then transfer the approved inventory to that campaign.
5. Set server-only `POCKET_WELCOME_REWARD_ADDRESS` and `POCKET_WELCOME_REWARD_CHAIN_ID=31611`; use the configured `RELAYER_PRIVATE_KEY` matching the authorizer. GET `/api/rewards/welcome` checks readiness before the UI enables claims.
6. Make one approved pilot claim, record its receipt and NFT ownership/expiry, reload and verify no second reward. The contract enforces one claim per identity hash and wallet per deployment, not one per human. Funding limits bound the campaign.

Operational limit: a `SENDING` reservation with no hash must be checked against the relayer nonce/history and on-chain `claims` mapping before manual recovery. Never automatically expire it or enable blind retries. A missing journal table or unavailable database stops claims. The shared relayer uses an in-process nonce manager; multi-instance operation with other relayer jobs needs coordinated nonce management or a dedicated serialized reward worker before campaign rollout.

## Remaining verification

- **Partial repayment:** needs a user-selected active Trove, or an approved new loan. Quote BTC collateral, mUSD draw, borrowing fee, reserve, exact repayment and remaining net debt before signing. Refresh the protocol minimum and recovery-mode status. Capture the successful `repayMUSD` receipt and before/after debt and wallet balances. There is no active Trove to test in the inspected wallet.
- **User/merchant testing:** the user will contact testers. No outreach or adoption claims were made. Use [the testing guide](mezo-testing-guide.md).

## Checks

- `pnpm test:wealth`: Savings accounting/recovery, authenticated merchant updates/name snapshots, reward configuration/recovery/reservations, owned lock enumeration, swap/pool quote protections, lock lifecycle rules, wallet identity and pending-transaction recovery.
- `pnpm test:checkout`, `pnpm test:payments`, `pnpm test:reconcile`: payment regressions.
- `forge test --match-contract '^PocketWelcomeRewardTest$'` in `contracts`: 14 contract tests including signature replay, ownership, expiry and rollback; fuzzing covers weekly rounding.
- `forge test --match-contract PocketWelcomeRewardForkTest` with `MEZO_REWARD_FORK_RPC`: local fork of deployed veMEZO. The Cosmos MEZO precompile is replaced by a mintable EVM fixture; this is not proof of a real token transfer or a live campaign.
- `MEZO_POOL_FORK_RPC=https://rpc.test.mezo.org forge test --match-contract PocketWealthForkTest --gas-limit 100000000 -vv` in `contracts`: five local-fork tests at block 16,525,761. Exercises deployed router/pool/escrow code for liquidity deposits/removals, swaps in both directions, slippage refusal, pool fee claims, lock creation/top-up/extension/withdrawal and permanent unlock. Tokens (including Cosmos precompiles) are EVM fixtures, so this does not prove live token transfers. The multi-operation tests use a raised test gas budget; the four-year scenario advances through periodic checkpoints to model continuing chain activity.
- `node scripts/check-wealth-browser.mjs`: mobile components and real client transaction controllers against explicit RPC/wallet fixtures. Checks Home/Swap/Wealth navigation, swap/lock/pool controls, separate approval/final confirmations, pending recovery without signing, uncertain submission handling, mobile button visibility and merchant save failure/success. It does not authenticate or write to the real backend.
- `node scripts/check-checkout-browser.mjs`: actual local app, anonymous authentication/checkout smoke checks.

Current validation: **61 Wealth/merchant/reward tests and five local-fork lifecycle tests passed**. The mobile component checks passed for swaps, locks, pools, separate approvals, pending recovery, merchant saves, and the Home/Swap/Wealth dock at both 390px and 320px widths. Focused ESLint, TypeScript and the production build passed. The actual local app passed anonymous checkout/authentication checks with no browser page errors.

The earlier payment work passed 59 checkout tests, 39 payment tests, 18 reconciliation assertions, 14 welcome-reward contract tests and one reward local-fork test. That November 2 work executed no live financial transaction or database migration. The November 3 activation applied the additive journal SQL and executed the builder-approved campaign deployment and 100-MEZO funding. Local-fork and browser fixture tests are not evidence of live wallet signatures.
