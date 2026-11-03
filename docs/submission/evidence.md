# Wave 2 evidence index

Updated 3 November 2026. All transactions are Mezo testnet. Chain outcomes do not establish independent customers or every frontend interaction.

| Action | Receipt | Verified outcome |
| --- | --- | --- |
| Savings claim | [0x43149c…08cfdf](https://explorer.test.mezo.org/tx/0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf) | Correct owner/destination/calldata, successful receipt, 187.366117347141378 mUSD received |
| Savings claim | [0x527173…b7a3af](https://explorer.test.mezo.org/tx/0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af) | Same checks; 0.00228183663115 mUSD received |
| Liquidity add | [0xef7929…6e9409](https://explorer.test.mezo.org/tx/0xef79292d44ad002722c6e4532abb33d0d679d0240c867c587784391fbd6e9409) | Successful receipt at block 16,526,068; indexed router addLiquidity call |

[Claim details](../evidence/mezo-feature-receipts.json) · [November 3 chain/deployment/database baseline](../evidence/wave-2-status-2026-11-03.json)

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

The confirmed @musd_pocket identity now has a Business/Pocket profile in its existing wallet. The reviewed welcome journal SQL was applied. [Merchant setup proof](../evidence/wave-2-merchant-setup.json).

The approved 20-MEZO campaign is deployed at `0xa78709beb3841aac1ed8fc3d8dedf74d55f62432` and funded with 100 MEZO for five claims. [Deployment](https://explorer.test.mezo.org/tx/0x94b45c98d747b1c5c8a071f6dc7c5a66cd15e1839d546396aab7bb34c138883e) · [Funding](https://explorer.test.mezo.org/tx/0x7715444a058604c275bef42a2c5b3d0b94707369f732a8ead5ea5c0d01b703d6) · [Configuration and gas proof](../evidence/wave-2-welcome-deployment.json).

Pending: live partial repayment with before/after debt/collateral; independent feedback and repeat use; one real new-campaign NFT claim; official Wave 2 deadline and submission confirmation.

[Submission draft](submission.md) · [Pilot record](pilot-record.md) · [Testing guide](../mezo-testing-guide.md)
