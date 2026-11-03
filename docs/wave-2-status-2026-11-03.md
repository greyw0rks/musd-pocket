# Pocket Wave 2 status — 3 November 2026

This is the initial baseline review. Later on November 3, the builder authorized delivery work: the main README and deck were updated, @musd_pocket became the Pocket Business profile, the reward journal SQL was applied, and the approved 20-MEZO campaign was deployed/funded. See [current evidence](submission/evidence.md) and [the approved repayment plan](submission/repayment-plan.md). The baseline also missed an existing empty 200-MEZO campaign configured only in production; its inspection is retained in [legacy campaign evidence](evidence/wave-2-legacy-welcome-campaign.json).

Wave 2 has substantial local implementation, but the current build, independent merchant use and submission materials are not yet delivered together. This review inspected the working repository, public GitHub main, live Vercel deployment, aggregate database counts and public Mezo transactions. It reran existing tests. No app fixes, database mutations, deployments or financial transactions were performed.

## Wave 1 feedback checklist

| Feedback | Current evidence | Remaining work |
| --- | --- | --- |
| Bring in real users beyond the builder's wallets | Database has 6 personal accounts, 4 completed faucet claims and 8 DIRECT/PAID payment records. These counts do not prove independent people or repeat use. | Recruit and document independent users; retain consented feedback, their payment receipts and repeat-use evidence. |
| Create new MUSD demand | Merchant profile, shareable payment links, QR checkout and direct MUSD settlement are built locally with authenticated payee binding, receipt verification and recovery. The live checkout route exists. Database currently has 0 merchant accounts and 0 payment requests. | Deploy the current merchant experience and run a real merchant/customer pilot. Record merchant invoices, MUSD acquired/paid and repeat use. No BTC Trove add-collateral or automatic liquidation-protection flow was found. MEZO lock top-ups are a separate feature. |
| Add pitch deck | Eight-slide PDF, JSON and HTML exist in musd-pocket-wave1/docs/submission. | Refresh for Wave 2: merchant checkout is now built, claimYield receipts exist, Swap/Wealth is implemented, and adoption remains unproved. Move/link the current deck into the main repo and submission. |
| State track and revenue model | Reference README/deck state Track 2: Access and Distribution for MUSD/MEZO, with proposed merchant fees covering sponsored gas and possible premium merchant tools. | Include these explicitly in the main README and Wave 2 submission. Pricing and fee collection are not implemented or validated. Current direct payments use payer BTC for gas. |
| Update README for direct transfers | Main README adds links to accurate feature docs, but its body still says funds live in a vault and the server moves them. The reference README describes direct transfers correctly. | Replace the main README's legacy architecture, custody and gas claims with the current direct-wallet flow; label remaining legacy/cross-chain code clearly. |
| Exercise repay on-chain | Fresh block 16,554,728: inspected wallet Trove closedByOwner, debt 0. All 29 indexed outgoing transactions inspected; no repayMUSD selector. | Use an intended active Trove or approved new testnet loan, complete one partial repayment, and retain receipt plus before/after debt and collateral. Closing a Trove does not establish partial repayment. |
| Exercise claimYield on-chain | Two successful claims already verified: 187.366117347141378 and 0.00228183663115 testnet MUSD. Both remain in today's indexed history. | Attach receipts to the Wave 2 materials and capture the current in-app claim experience when positive yield exists. No new claim is required just to fill the historical receipt gap. |

## Other Wave 2 work already built

- Savings false-zero accounting fixed: stored plus global-index accrual, one-block reads, positive payout simulation and recovery without a second signature.
- Direct payment recording/recovery isolated from legacy vault reconciliation, with sender/token/recipient/amount/log checks and proof-reuse protection.
- Local Home / Swap / Wealth navigation; in-app mUSD swaps with BTC, mUSDC and mUSDT; Vault, Lock and Pools controls.
- MEZO lock creation, top-up, extension, expiry withdrawal and permanent-lock lifecycle.
- Pool liquidity add/remove and fee claims. Existing live liquidity add independently confirmed successful: [receipt](https://explorer.test.mezo.org/tx/0xef79292d44ad002722c6e4532abb33d0d679d0240c867c587784391fbd6e9409), block 16,526,068. This proves that transaction, not every local UI action.
- Welcome-reward contract/API/UI: 20 testnet MEZO per account and wallet, locked for two weekly epochs (7–14 days after rounding), with persistent reservation/replay protections.

Current validation rerun: 61 Wealth/profile/reward + 59 checkout + 39 payment + 18 reconciliation checks = **177 passing checks**. Existing November 2 evidence additionally records five local-fork lifecycle tests, mobile fixture checks and a successful production build; those were not rerun here. Fork token fixtures and simulated wallet tests do not establish live user signatures.

## Deployment and activation gaps

Live Vercel production is Ready, deployment dpl_BUkiyGnXsJ14PjW5PSG6w9mzJn23, created October 31 at 23:36 UTC / November 1 at 00:36 Lagos. It serves /pay/[shortId], but its public app bundle still uses Home / Vault / Spending, whereas local source uses Home / Swap / Wealth. The latest local changes therefore still need deployment.

Public GitHub main remains 8599ebfac0dc6983d2264bd7a15bcbf45a9a211a. Substantial Wave 2 changes are uncommitted/untracked; publish a reviewed implementation and evidence bundle.

Welcome rewards remain inactive: the database has no welcome_reward_attempts table, and current docs record no campaign deployment/funding. Apply the reviewed additive SQL, choose admin/authorizer and budget, deploy/verify/fund the campaign, set server configuration, then prove one real claim/NFT ownership and no repeat reward. This onboarding incentive is not itself proof of MUSD demand.

The inspected Notion hackathon tracker records Wave 1 won, Wave 2 Building and no submission confirmation. Its official Wave 2 deadline is not verified.

## Finish in this order

1. Refresh and consolidate the main README, deck, track/revenue description and receipt evidence.
2. Commit/publish the current changes and deploy the full merchant + Swap/Wealth build.
3. Run independent merchant/customer pilots and record settled invoices, feedback and repeat usage. Suggested pilot sizes in the deck are targets, not achieved counts or judging requirements.
4. Complete one live partial repayment with receipt and before/after state.
5. Activate and verify welcome rewards if they remain part of the Wave 2 promise.
6. Confirm the official Wave 2 requirements/deadline; submit the current repo, app, deck, updated demo and evidence, then retain confirmation.

[Machine-readable review](evidence/wave-2-status-2026-11-03.json). [Existing feature guide](mezo-wealth.md). [Pilot testing guide](mezo-testing-guide.md).
