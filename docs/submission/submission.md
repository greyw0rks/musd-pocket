During Wave 2, Pocket extended Mezo Borrow and Savings into a mobile payment journey: Bitcoin holders can access mUSD and spend it through social payments and merchant checkout from one embedded wallet. I added verified merchant offers, weekly tasks, BTC locks, transaction recovery and Android 0.2.5 on Mezo Testnet.

App: https://mpocket.tech/home
Android: https://mpocket.tech/downloads/mpocket-0.2.5.apk
Deck: https://mpocket.tech/pitch-deck.pdf
Repo: https://github.com/greyw0rks/musd-pocket

- Payments: Users sign direct mUSD transfers from Privy embedded wallets. Pocket verifies network, sender, token, recipient, amount, calldata, receipt and Transfer event. Proof reuse across invoices is blocked.
- Merchant checkout: Added Business profiles, invoice links and QR checkout. Invoices survive sign-in; paid invoices and Activity are recorded together.
- Verified merchants: Any confirmed positive mUSD payment to @grey_labs unlocks one persistent random 10–30% Greylabs merch discount. Coupon issuance and public validation enforce payment eligibility.
- Mainnet waitlist: Moved checkout from Home to Send → Verified merchants. Each wallet reuses its invoice and recovers pending/completed payments. A 100-testnet-mUSD builder payment was verified. Opening checkout sends nothing; payment requires confirmation and does not activate mainnet access.
- Weekly checklist: Tasks cover sending mUSD to five different friends, inviting three friends, borrowing, repayment, liquidity, swaps and BTC locks. Progress comes from confirmed activity and qualifying referrals; tasks reset weekly. Removed the welcome reward because the testnet faucet already supplies starting funds.
- Recovery: Saved hashes survive reloads and enable “Check confirmation” without another transfer. Tests cover RPC uncertainty, recording/storage failures, duplicates, conflicting proofs and legacy-ledger isolation.
- Borrowing and Savings: Verified a 0.05-BTC Trove, 2,000-mUSD mint, 10-mUSD repayment and closure with collateral returned. Repayment accounts for interest accrual. Fixed Savings yield accounting and verified two claims. Claims verify actual mUSD payouts, display precise amounts and prepare BTC fees before confirmation. Lost wallet responses recover through a saved hash or nonce; explicit retries reuse that nonce.
- Wealth: Added supported holdings, verified-pool swaps, liquidity add/remove, fee claims and BTC lock lifecycle controls. New locks use veBTC with the deployed testnet contract's 30-day maximum and weekly rounding. Previous MEZO positions remain manageable. BTC lifecycle checks use deployed code on a local fork with a fixture token; no live BTC lock is claimed.
- Android 0.2.5: Added a mobile interface, floating Home/Swap/Wealth navigation, dismissible sheets and browser OAuth return to the app. Restored Privy after logout; removed Telegram and Chrome install prompts. Added Google linking and persistent receipt-email preferences. Fixed wallet/network selection, account caches, button spinners and post-confirmation claim recovery.
- Validation/materials: 231 existing checks passed on November 12: 106 Savings/Wealth/wallet/profile/merchant/reward, 68 checkout/waitlist, 39 payment/recovery and 18 reconciliation. Android evidence covers 29 screens at three widths, build/signing and live APK checks. Updated README, recovery/testing docs, the builder-payment timeline and ten-slide deck.

Track 2: Access and Distribution for MUSD/MEZO. Proposed merchant fees fund gas/operations; users currently pay BTC gas. No revenue or independent adoption is claimed. Evidence is testnet; device/account flows remain unverified. Receipt email delivery is not configured.

Next three milestones:

1. November 16–30, 2026: complete a merchant pilot with independent customers and Android account acceptance; record settled invoices, fulfillment, feedback and repeat use.
2. December 1–15, 2026: improve merchant settlement/reporting and validate pricing against measured gas, operations and support costs.
3. December 16, 2026–January 15, 2027: prepare a limited Mezo Mainnet pilot using the verified recovery/protocol integrations and merchant feedback to set launch scope.

[Complete AKINDO text fields](akindo-fields.md) · [Evidence](evidence.md) · [Pilot record](pilot-record.md).
