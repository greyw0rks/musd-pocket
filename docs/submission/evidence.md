# Wave 2 evidence index

Updated 13 November 2026. All transactions are Mezo testnet. Chain outcomes do not establish independent customers or every frontend interaction.

| Action | Receipt | Verified outcome |
| --- | --- | --- |
| Savings claim | [0x43149c…08cfdf](https://explorer.test.mezo.org/tx/0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf) | Correct owner/destination/calldata, successful receipt, 187.366117347141378 mUSD received |
| Savings claim | [0x527173…b7a3af](https://explorer.test.mezo.org/tx/0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af) | Same checks; 0.00228183663115 mUSD received |
| Liquidity add | [0xef7929…6e9409](https://explorer.test.mezo.org/tx/0xef79292d44ad002722c6e4532abb33d0d679d0240c867c587784391fbd6e9409) | Successful receipt at block 16,526,068; indexed router addLiquidity call |
| Partial repayment | [0x77596c…c31e7](https://explorer.test.mezo.org/tx/0x77596c3ad14f654f73952c2f5dfdcb05bbe8d30e93ff205bc5935ab6d70c31e7) | Exact 10 mUSD calldata/burn/wallet debit; exact debt reduction after interest accrual; 0.05 BTC collateral unchanged; protocol event matches |
| Trove open | [0xa6f7cd…6b752](https://explorer.test.mezo.org/tx/0xa6f7cdd5570fd32f2ead694375072f30bdd26a4623e5b31df29337a31876b752) | 0.05 BTC collateral, 2,000 mUSD minted to the owner, active Trove with 2,202 composite debt |
| Trove close | [0xa5cc35…d93f6](https://explorer.test.mezo.org/tx/0xa5cc358a589f8966b76c20d6d2881e765e50d25eeec2da2723406d4ec8ed93f6) | 1,992.000040389198735212 mUSD burned; 0.05 BTC returned by ActivePool; closedByOwner, debt/collateral zero |
| Historical welcome claim | [0x798fd4…4ff48](https://explorer.test.mezo.org/tx/0x798fd4f01b0e9ae68a322ab0848345f655e527e85b1c8f7356ff4d575d74ff48) | NFT #941 owned by recipient, 20 MEZO locked until November 12; campaign journal and event agree; replay simulation returns AlreadyClaimed. New welcome rewards are retired. |
| Builder waitlist checkout | [0x056b91…3195](https://explorer.test.mezo.org/tx/0x056b918e9620de6ef203312880f6dc6872e8db71ac2d7edf59c58f074a363195) | Exact 100 mUSD transfer from the builder's Trove/Savings wallet to Pocket; invoice and direct Activity record are PAID |

[Claim details](../evidence/mezo-feature-receipts.json) · [November 3 chain/deployment/database baseline](../evidence/wave-2-status-2026-11-03.json)

[Repayment before/after proof](../evidence/wave-2-repayment-proof.json) accounts for 0.00000209335806576 mUSD accrued between the compared blocks. Raw block debt falls by 9.99999790664193424; at the repayment timestamp, debt falls by exactly 10. The source-derived calculation, storage reads, event and token burn agree.

[Open/close proof](../evidence/wave-2-borrow-lifecycle.json) · [Historical welcome NFT and replay proof](../evidence/wave-2-welcome-claim.json). Replay was simulated, never broadcast. The campaign held 80 MEZO after the first verified claim on November 3. Android 0.2.5 removes welcome issuance and retains recovery for existing records.

Fresh November 12 RPC reads at testnet block 16,741,784 confirmed both Savings payouts, Trove opening, repayment, closure, the waitlist transfer and the welcome receipt. The [November 12 review checks](../evidence/buildathon-review-2026-11-12.json) record those reads. Interest, collateral-return and NFT ownership/replay details retain their original before/after proofs.

## Validation

- [Android 0.2.5 validation](../evidence/android/validation-0.2.5.json): finance/backend tests, three-width screen checks, claim recovery controls, original-certificate APK signing and asset comparison. Physical device/account flows remain unverified.
- [BTC lock configuration](../evidence/btc-lock-readiness-2026-11-12.json): deployed veBTC token, implementation, native/ERC-20 BTC balance agreement, three-field position ABI and 30-day maximum. Two local fork lifecycle tests exercise create/top-up/extend/withdraw and permanent unlock with a fixture BTC token; they create no live lock.
- November 12: **231 existing checks passed** — 106 Savings/Wealth/wallet/profile/merchant/reward, 68 checkout/waitlist, 39 payment/recovery and 18 reconciliation.
- The earlier November 3 total was 177: 61 Wealth/profile/reward, 59 checkout, 39 payment and 18 reconciliation.
- [Android 0.2.4 validation](../evidence/android/validation-0.2.4.json): 29 screen fixtures at 320/390/640px, wallet/network/cache regressions, precise interest display, APK assembly/signing and production-build checks. Physical device/account flows remain unverified.
- [November 2 validation](../evidence/inapp-wealth-validation.json): five fork lifecycle tests with fixture tokens, mobile checks, focused lint and production build.
- [Unsigned Wealth readiness](../evidence/inapp-wealth-readiness.json): verified pool/token configuration and captured quotes.
- [Savings/Borrow readiness](../evidence/mezo-wealth-readiness.json): principal and Trove status at its captured block.

Refresh without signing:
```sh
node --env-file=.env --import tsx scripts/check-mezo-feature-receipts.ts
node --env-file=.env --import tsx scripts/check-mezo-wealth.ts
node --env-file=.env --import tsx scripts/check-inapp-wealth.ts
```

Balances and quotes change. Forks and simulated wallets are not live signatures.

## Adoption and missing proof

The archived November 3 pre-merchant snapshot records 6 personal accounts, 4 completed faucet claims, 8 paid direct transfers and no invoices. The [November 12 read-only database snapshot](../evidence/wave-2-pilot-snapshot-2026-11-12.json) records 6 accounts (4 personal, 2 merchant), 4 completed faucet claims, 11 paid direct transfers and 1 paid invoice. These are account/payment counts, not independently verified people or paying customers.

The builder proposed the product's X account as the first Business profile. Record it as builder-operated. Distinguish independent customers and item/service payments from app tests.

The confirmed @musd_pocket identity has a Business/Pocket profile in its existing wallet. The reviewed welcome journal SQL was applied. Its first 100-testnet-mUSD closed-mainnet waitlist invoice was paid on November 3 at 22:39:35 UTC by the builder wallet. The November 12 database check confirms both the PAID invoice and matching DIRECT payment record. Payment does not activate mainnet access. [Merchant setup proof](../evidence/wave-2-merchant-setup.json) · [Original invoice setup](../evidence/wave-2-waitlist-pilot.json) · [Current pilot record](pilot-record.md).

The historical 20-MEZO campaign is deployed at `0xa78709beb3841aac1ed8fc3d8dedf74d55f62432` and was funded with 100 MEZO. [Deployment](https://explorer.test.mezo.org/tx/0x94b45c98d747b1c5c8a071f6dc7c5a66cd15e1839d546396aab7bb34c138883e) · [Funding](https://explorer.test.mezo.org/tx/0x7715444a058604c275bef42a2c5b3d0b94707369f732a8ead5ea5c0d01b703d6) · [Configuration and gas proof](../evidence/wave-2-welcome-deployment.json). New reward requests now return HTTP 410; users obtain starting funds from the faucet and create their own BTC locks.

Pending: independent customer payments, fulfillment, feedback and repeat use; physical Android/account acceptance; actual AKINDO submission confirmation. The supplied program rules end the Wave 2 build period on November 15; the exact platform cutoff time and timezone should follow AKINDO's displayed deadline.

[Live delivery and verification](delivery.md).

[Submission draft](submission.md) · [Pilot record](pilot-record.md) · [Testing guide](../mezo-testing-guide.md)
