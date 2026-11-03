# Wave 2 evidence index

Updated 3 November 2026. All transactions are Mezo testnet. Chain outcomes do not establish independent customers or every frontend interaction.

| Action | Receipt | Verified outcome |
| --- | --- | --- |
| Savings claim | [0x43149c…08cfdf](https://explorer.test.mezo.org/tx/0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf) | Correct owner/destination/calldata, successful receipt, 187.366117347141378 mUSD received |
| Savings claim | [0x527173…b7a3af](https://explorer.test.mezo.org/tx/0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af) | Same checks; 0.00228183663115 mUSD received |
| Liquidity add | [0xef7929…6e9409](https://explorer.test.mezo.org/tx/0xef79292d44ad002722c6e4532abb33d0d679d0240c867c587784391fbd6e9409) | Successful receipt at block 16,526,068; indexed router addLiquidity call |
| Partial repayment | [0x77596c…c31e7](https://explorer.test.mezo.org/tx/0x77596c3ad14f654f73952c2f5dfdcb05bbe8d30e93ff205bc5935ab6d70c31e7) | Exact 10 mUSD calldata/burn/wallet debit; exact debt reduction after interest accrual; 0.05 BTC collateral unchanged; protocol event matches |
| Trove open | [0xa6f7cd…6b752](https://explorer.test.mezo.org/tx/0xa6f7cdd5570fd32f2ead694375072f30bdd26a4623e5b31df29337a31876b752) | 0.05 BTC collateral, 2,000 mUSD minted to the owner, active Trove with 2,202 composite debt |
| Trove close | [0xa5cc35…d93f6](https://explorer.test.mezo.org/tx/0xa5cc358a589f8966b76c20d6d2881e765e50d25eeec2da2723406d4ec8ed93f6) | 1,992.000040389198735212 mUSD burned; 0.05 BTC returned by ActivePool; closedByOwner, debt/collateral zero |
| Welcome claim | [0x798fd4…4ff48](https://explorer.test.mezo.org/tx/0x798fd4f01b0e9ae68a322ab0848345f655e527e85b1c8f7356ff4d575d74ff48) | NFT #941 owned by recipient, 20 MEZO locked until November 12; campaign journal and event agree; replay simulation returns AlreadyClaimed |

[Claim details](../evidence/mezo-feature-receipts.json) · [November 3 chain/deployment/database baseline](../evidence/wave-2-status-2026-11-03.json)

[Repayment before/after proof](../evidence/wave-2-repayment-proof.json) accounts for 0.00000209335806576 mUSD accrued between the compared blocks. Raw block debt falls by 9.99999790664193424; at the repayment timestamp, debt falls by exactly 10. The source-derived calculation, storage reads, event and token burn agree.

[Open/close proof](../evidence/wave-2-borrow-lifecycle.json) · [Welcome NFT and replay proof](../evidence/wave-2-welcome-claim.json). Replay was simulated, never broadcast. Remaining inventory is 80 MEZO for four claims.

## Validation

- 61 Wealth/profile/reward + 59 checkout + 39 payment + 18 reconciliation assertions passed on November 3.
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

Baseline: 6 personal accounts, 4 completed faucet claims, 8 paid direct transfers, no merchants or invoices. These do not establish independent humans or paying customers.

The builder proposed the product's X account as the first Business profile. Record it as builder-operated. Distinguish independent customers and item/service payments from app tests.

The confirmed @musd_pocket identity now has a Business/Pocket profile in its existing wallet. The reviewed welcome journal SQL was applied. A 100-testnet-mUSD closed-mainnet waitlist invoice is prepared, pending customer payment. [Merchant setup proof](../evidence/wave-2-merchant-setup.json) · [Waitlist invoice](../evidence/wave-2-waitlist-pilot.json).

The approved 20-MEZO campaign is deployed at `0xa78709beb3841aac1ed8fc3d8dedf74d55f62432` and funded with 100 MEZO for five claims. [Deployment](https://explorer.test.mezo.org/tx/0x94b45c98d747b1c5c8a071f6dc7c5a66cd15e1839d546396aab7bb34c138883e) · [Funding](https://explorer.test.mezo.org/tx/0x7715444a058604c275bef42a2c5b3d0b94707369f732a8ead5ea5c0d01b703d6) · [Configuration and gas proof](../evidence/wave-2-welcome-deployment.json).

Pending: independent customer payments, fulfillment, feedback and repeat use; official Wave 2 deadline and submission confirmation.

[Live delivery and verification](delivery.md).

[Submission draft](submission.md) · [Pilot record](pilot-record.md) · [Testing guide](../mezo-testing-guide.md)
