# Wave 2 delivery — 13 November 2026

Android 0.2.5 publishes the current mobile product and its matching web source. Vault claims prepare fees before wallet confirmation, preserve uncertain hashes or nonces, and recover the actual mUSD payout. New locks use Mezo's veBTC contract with its 30-day testnet maximum; previous MEZO positions retain lifecycle controls. The welcome reward has ended and Weekly tasks open immediately. The existing testnet faucet supplies starting funds.

[Android APK](https://mpocket.tech/downloads/mpocket-0.2.5.apk) · [Release notes](../android-0.2.5-handoff.md) · [Validation](../evidence/android/validation-0.2.5.json) · [BTC fork results](../evidence/btc-lock-fork-2026-11-13.json).

November 13 verification passed 257 automated checks: 132 Savings/Wealth/wallet/profile/merchant/reward, 68 checkout/waitlist, 39 payments/recovery and 18 reconciliation. Type checking, focused lint, the production web build, ten-slide deck layout/navigation and signed-APK verification passed. All 253 packaged web assets match the mobile build. Two local-fork BTC lifecycle tests use a fixture token; they create no live BTC lock. The retained mobile checks cover 29 app screens at 320, 390 and 640 pixels. Physical Android account/signing flows remain unverified.

The first 100-testnet-mUSD invoice was paid on November 3 by the builder's Trove/Savings wallet. Its PAID invoice and Activity record agree in the dated database snapshot. It is a builder test; independent customer purchase, fulfillment, feedback and repeat use remain pending. [Pilot record](pilot-record.md).

The deck and [AKINDO text fields](akindo-fields.md) include three dated future milestones. The existing video is retained as requested. The text fields are prepared locally; an AKINDO update/submission confirmation has not been recorded.

## Historical November 3 delivery

Canonical website: **https://mpocket.tech**. [App](https://mpocket.tech/home) · [Pitch PDF](https://mpocket.tech/pitch-deck.pdf) · [HTML deck](https://mpocket.tech/pitch-deck.html).

[PR #16](https://github.com/greyw0rks/musd-pocket/pull/16) merged at 22:00:50 UTC, commit `030fa92faae1daaeeacbe12e26be5971499e1157`. Its production deployment `dpl_93PqmUxg49M7RvmDCM3UxhZ5heNB` is Ready and serves mpocket.tech. Both PR checks passed. Anonymous mobile Home/checkout/authentication checks passed without page errors.

Follow-up source for the balance card, completed receipts and canonical links: [PR #17](https://github.com/greyw0rks/musd-pocket/pull/17).

## Wave 1 feedback delivered

| Feedback | Result |
| --- | --- |
| New mUSD demand mechanism | Merchant profiles, invoice links and QR checkout settle directly in mUSD. Pocket's builder-operated Business profile has a 100-testnet-mUSD closed-mainnet waitlist invoice. Independent customer demand is still unproved. |
| Pitch deck | Ten slides in editable JSON, HTML and PDF; receipts, actual adoption limits and pilot offer included. |
| Track and revenue | Track 2: Access and Distribution for MUSD/MEZO. Proposed merchant fees covering gas/operations; fee collection and revenue remain unimplemented. |
| README architecture | Current direct user-wallet transfers and BTC gas behavior documented. |
| On-chain repay | 10 mUSD burned, exact repayment after interest accrual, unchanged 0.05 BTC collateral. Open and close also verified; collateral returned and final debt zero. |
| On-chain claimYield | Two successful historical claims verified and linked. |
| Historical welcome pilot | Campaign deployed/funded within the approved BTC gas cap. First 20-MEZO claim verified as NFT #941; ownership, lock and repeat-claim refusal verified. New claims ended in Android 0.2.5; historical recovery remains available. |

[Chain evidence](evidence.md) records receipts and before/after proofs. Verification scripts are read-only; no repeat repayment or claim is required. No payment was observed when the first invoice was set up. It is now a [confirmed builder receipt](https://mpocket.tech/pay/89YAGVPYD8ZXYE6FJWZUK652); prepare a separate invoice for an independent customer.

The additional Home card change keeps mUSD/BTC prominent and shows positive supported wallet tokens below them. It excludes unpriced holdings from the priced sum and counts sMUSD principal once. [Mobile balance-card checks](../evidence/wave-2-balance-card.json) passed at 390px and 320px: zero balances hidden, tiny positive holdings visible, primary text larger, no clipping/overflow and card flipping preserved.

## Still needed

1. Independent customers using their own wallets, with settled invoices, fulfillment, consented feedback and repeat use. Builder-wallet tests do not satisfy this.
2. Physical Android account/signing acceptance and independent pilot observations. The existing video is retained as requested.
3. Actual AKINDO text update and retained confirmation. Follow AKINDO's displayed cutoff; the supplied rules give a November 15 build-period end without an exact time or timezone. No submission or new X post was sent in this delivery.

Historical November 3 validation included 177 assertions and 14 welcome Solidity tests. Current 0.2.5 validation is recorded above. Live proofs establish the named actions; testnet payments do not establish mainnet revenue.
