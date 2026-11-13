**Pocket — Mezo Buildathon Wave 2 review, 12 November 2026**

Pocket has made meaningful progress against the Wave 1 feedback. The urgent problem is publication: the canonical app and public default branch expose an earlier build than the supplied Wave 2 update describes. Align the source, deployment, deck and Android download before presenting the newer features to judges.

This review used the clean release checkout at `218d95be374cac94dd33a62812ea7e408134c290`, current public GitHub `main` at `a4ead5bfcbd1229a299a146cd757d04240e5481f`, public HTTP/deployment checks and fresh Mezo RPC receipt reads. The newer uncommitted UI work in the main local checkout was outside this assessment. The program rules and November 15 build-period end come from the user's supplied text; it does not state an exact submission cutoff time or timezone.

[Machine-readable checks](evidence/buildathon-review-2026-11-12.json).

The most important findings, in order:

1. **P1 — The advertised latest release is not available through the submission's canonical links.** `https://mpocket.tech/downloads/mpocket-0.2.4.apk` returns 404. So do `/auth/android`, `/api/rewards/weekly`, `/api/merchants/greylabs/coupon` and `/api/waitlist/checkout`. The existing Home page returns 200 and the invoice API requires authentication with 401, so this is a mismatch between releases, rather than evidence that the entire app is offline. The live PDF is the November 3 deck: 62,512 bytes, SHA-256 `c63f7107…f2388`; the revised release deck is 325,614 bytes, SHA-256 `e7d11f37…056b`.

   Vercel resolves the canonical domain to `dpl_8XujujMeChT4i7gQgJitSDVckivi`, created November 6 at 23:56:43 UTC. The earlier reviewed release, [dpl_ESGTTJ9DQXDwZTKJaf2513WSmoGP](https://musd-pocket-7sal28di9-greyw0rks-projects.vercel.app), still serves the correct APK and revised PDF; both hashes match the local release. A later production build superseded those assets on the canonical domain. Publish the reviewed source to the public branch used for production and deploy that matching commit.

2. **P1 — Public default-branch source does not include important advertised additions.** The complete public `main` tree lacks `hooks/use-session-wallet.ts`, `lib/merchants/access.ts`, `lib/waitlist/checkout.ts` and `public/downloads/mpocket-0.2.4.apk`. The public submission draft and deck describe the earlier November 3 release. The public-repository requirement has a repository link, but reviewers cannot use its default branch to inspect the full latest implementation described in the update.

3. **Required material remains unverified: the two-minute pitch video.** No current pitch-video URL appears in the supplied update, the latest local submission text or the public submission draft. The actual AKINDO form was not inspected, so this is a material to confirm, not a claim that the form definitely lacks it. All required materials must be attached for screening. An APK and a PDF do not establish that the required video is present.

4. **The largest remaining judging gap is independent demand.** Merchant checkout answers the requested mechanism for extending MUSD utility. Fresh chain reads confirm the 100-MUSD waitlist payment, but its sender is the same builder wallet used for the Trove and Savings evidence. No independent purchase, fulfillment, customer feedback or return use is evidenced in this submission. The Greylabs gate accepts any positive MUSD amount; describe it as an activation experiment. A completed merchant order and subsequent use provide stronger evidence of demand than a discount unlock, faucet claim or additional wallet count.

5. **P2 — The evidence narrative needs a current timeline.** The evidence index and pilot record still describe the first invoice as pending, although its 100-MUSD builder payment is confirmed. Update that record with the receipt and builder-test classification. The public README also labels 16 personal accounts and 14 faucet claims as the November 3 baseline, while the retained November 3 evidence records 6 and 4. Reconcile the dated snapshots before using those counts; neither count demonstrates independent people. Add three future milestones with dates to the form. The current deck has pilot targets without a dated three-milestone roadmap.

Wave 1 feedback is addressed as follows:

| Wave 1 request | Wave 2 assessment |
| --- | --- |
| Deeper Mezo integration | Strong: Troves, Savings, verified-pool swaps/liquidity and MEZO locks extend existing Mezo products. The newer release must be accessible to reviewers. |
| New MUSD demand mechanism | Merchant profiles, invoices and checkout are implemented. Independent demand and repeat use remain unproved. |
| Real users beyond builder wallets | No qualifying independent-use evidence is supplied. Accounts and transfers alone cannot answer this. |
| Pitch deck | A ten-slide deck exists. The canonical URL serves the earlier version; the revised deck is retained on the earlier deployment. |
| Explicit track and revenue model | Track 2 is explicit. Proposed merchant fees for operations/future gas support are stated; fee collection and revenue are correctly not claimed. |
| README matches direct transfers | Public README explains direct wallet transfers and BTC gas. Its newer feature/version and snapshot details need alignment with the reviewed release. |
| Exercise repayment and claimYield on-chain | Addressed. Fresh successful receipts confirm the 10-MUSD repayment and both actual Savings payouts. |

My indicative assessment of the intended release, once its public source, links and required materials are aligned:

| Criterion | Weight | Indicative assessment |
| --- | ---: | --- |
| Mezo integration | 30% | Around 4–4.5/5: meaningful use of Borrow, Savings, pools and MEZO locks. |
| Product and business viability | 30% | Around 3/5: a useful payment destination and a plausible fee model; independent demand and costs still need validation. |
| Technical implementation | 20% | Around 4/5: verified direct transfers, atomic recording, recovery and protocol accounting, with existing limits documented. |
| User experience | 10% | Around 3.5–4/5 from the retained layout evidence; real Android installation and account/signing flows remain unverified. |
| Submission materials | 10% | Incomplete assessment until the current video and release are accessible. The revised deck presents the problem, product, proof and limits clearly. |

These are review estimates, not Mezo's official points or a predicted award. Integration is already a strong area. The two 30% criteria make customer demand and a clear Mezo spending journey valuable priorities for the remaining time.

Fresh verification passed **231 existing checks**: 106 Savings/Wealth/wallet/users/merchants/rewards, 68 checkout/waitlist, 39 payments/recovery and 18 reconciliation decisions. This includes the claimed 145 finance/payment subset plus checkout and reconciliation coverage. Existing Vitest and Node binaries ran the tests after pnpm's automatic dependency reconciliation stopped on the shared node_modules layout.

At testnet block 16,741,784, RPC reads confirmed successful receipts for both Savings claims, Trove opening, repayment, closure, the waitlist payment and the welcome claim. Actual MUSD Transfer logs show 187.366117347141378 and 0.00228183663115 MUSD Savings payouts, a 10-MUSD repayment burn, a 2,000-MUSD mint to the borrower and the 100-MUSD merchant transfer. The retained before/after repayment proof accounts for interest accrual; it was reviewed, not recomputed in this pass. Welcome NFT ownership/replay and collateral-return details retain their historical verification. These checks establish the named transactions, not every current frontend interaction. The broader 29-screen, APK signing/build and device-flow statements retain their earlier evidence; physical device/account flows remain unverified.

For November 15, prioritize a matching public source and canonical release, a current two-minute video, an independent merchant pilot with an actual item/service and feedback, and consistent submission fields/evidence. One merchant and two independent customers are a reasonable small pilot target, not a Buildathon minimum. A return payment would strengthen the continuing-use argument.

A focused submission sentence is:

> Pocket lets Bitcoin holders borrow MUSD on Mezo and spend it through social payments and merchant checkout from one embedded wallet.

Use **Social payments and checkout** as a four-word category and **Track 2: Access and Distribution for MUSD/MEZO** as the primary track. Set the chain/readiness to Mezo Testnet/testnet deployment when the submitted URL matches the described release. Explain the direct-transfer architecture and the user's BTC gas responsibility in the how-it-works field.

Suggested future milestones, subject to the builder's commitment:

| Timing | Milestone |
| --- | --- |
| November 16–30, 2026 | Complete an independent merchant pilot and Android account acceptance; record settled invoices, fulfillment, feedback and repeat use. |
| December 1–15, 2026 | Deliver merchant settlement/reporting improvements and validate pricing against measured gas, operations and support costs. |
| December 16, 2026–January 15, 2027 | Prepare a limited Mezo Mainnet pilot with the verified recovery and protocol integrations, using the pilot results to decide launch scope. |

This review added documentation and used read-only public checks. It did not publish source, change a deployment, submit on AKINDO, sign a transaction or contact customers.
