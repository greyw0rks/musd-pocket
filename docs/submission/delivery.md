# Wave 2 delivery — 3 November 2026

Canonical website: **https://mpocket.tech**. [App](https://mpocket.tech/home) · [Pitch PDF](https://mpocket.tech/pitch-deck.pdf) · [HTML deck](https://mpocket.tech/pitch-deck.html).

[PR #16](https://github.com/greyw0rks/musd-pocket/pull/16) merged at 22:00:50 UTC, commit `030fa92faae1daaeeacbe12e26be5971499e1157`. Its production deployment `dpl_93PqmUxg49M7RvmDCM3UxhZ5heNB` is Ready and serves mpocket.tech. Both PR checks passed. Anonymous mobile Home/checkout/authentication checks passed without page errors.

## Wave 1 feedback delivered

| Feedback | Result |
| --- | --- |
| New mUSD demand mechanism | Merchant profiles, invoice links and QR checkout settle directly in mUSD. Pocket's builder-operated Business profile has a 100-testnet-mUSD closed-mainnet waitlist invoice. Independent customer demand is still unproved. |
| Pitch deck | Ten slides in editable JSON, HTML and PDF; receipts, actual adoption limits and pilot offer included. |
| Track and revenue | Track 2: Access and Distribution for MUSD/MEZO. Proposed merchant fees covering gas/operations; fee collection and revenue remain unimplemented. |
| README architecture | Current direct user-wallet transfers and BTC gas behavior documented. |
| On-chain repay | 10 mUSD burned, exact repayment after interest accrual, unchanged 0.05 BTC collateral. Open and close also verified; collateral returned and final debt zero. |
| On-chain claimYield | Two successful historical claims verified and linked. |
| Welcome pilot | Campaign deployed/funded within the approved BTC gas cap. First 20-MEZO claim verified as NFT #941; ownership, lock and repeat-claim refusal verified. 80 MEZO remains for four claims. |

[Chain evidence](evidence.md) records receipts and before/after proofs. Verification scripts are read-only; no repeat repayment or claim is required. The first invoice is [ready for one customer](https://mpocket.tech/pay/89YAGVPYD8ZXYE6FJWZUK652), with no payment observed at setup.

The additional Home card change keeps mUSD/BTC prominent and shows positive supported wallet tokens below them. It excludes unpriced holdings from the priced sum and counts sMUSD principal once. [Mobile balance-card checks](../evidence/wave-2-balance-card.json) passed at 390px and 320px: zero balances hidden, tiny positive holdings visible, primary text larger, no clipping/overflow and card flipping preserved.

## Still needed

1. Independent customers using their own wallets, with settled invoices, fulfillment, consented feedback and repeat use. Builder-wallet tests do not satisfy this.
2. Current demo evidence and confirmation of the official Wave 2 rules/deadline.
3. Actual submission and retained confirmation. No submission or new X post was sent in this delivery.

Validation includes 177 existing assertions, 14 welcome Solidity tests, production builds, mobile fixtures and deck layout checks. Live proofs establish the named actions; testnet payments do not establish mainnet revenue.
