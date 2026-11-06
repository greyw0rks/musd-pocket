During Wave 2, I expanded mPocket on Mezo Testnet with payments, merchant checkout, weekly tasks and an Android app.

App: https://mpocket.tech/home
Android: https://mpocket.tech/downloads/mpocket-0.2.4.apk
Deck: https://mpocket.tech/pitch-deck.pdf
Repo: https://github.com/greyw0rks/musd-pocket

- Payments: Users sign direct mUSD transfers from Privy embedded wallets. Pocket verifies network, sender, token, recipient, amount, calldata, receipt and Transfer event. Proof reuse across invoices is blocked.
- Merchant checkout: Added Business profiles, invoice links and QR checkout. Invoices survive sign-in; paid invoices and Activity are recorded together.
- Verified merchants: Any confirmed positive mUSD payment to @grey_labs unlocks one persistent random 10–30% Greylabs merch discount. Coupon issuance and public validation enforce payment eligibility.
- Mainnet waitlist: Moved checkout from Home to Send → Verified merchants. Each wallet reuses its invoice and recovers pending/completed payments. A 100-testnet-mUSD builder payment was verified. Opening checkout sends nothing; payment requires confirmation and does not activate mainnet access.
- Weekly checklist: After the welcome bonus, tasks cover sending mUSD to five different friends, inviting three friends, borrowing, repayment, liquidity, swaps and MEZO locks. Progress comes from confirmed activity and qualifying referrals; tasks reset weekly.
- Recovery: Saved hashes survive reloads and enable “Check confirmation” without another transfer. Tests cover RPC uncertainty, recording/storage failures, duplicates, conflicting proofs and legacy-ledger isolation.
- Borrowing and Savings: Verified a 0.05-BTC Trove, 2,000-mUSD mint, 10-mUSD repayment and closure with collateral returned. Repayment accounts for interest accrual. Fixed Savings yield accounting and verified two claims. Claims now verify actual mUSD payouts, display precise amounts and preserve unresolved hashes.
- Wealth: Added supported holdings, verified-pool swaps, liquidity add/remove, fee claims and MEZO lock lifecycle controls. Verified the funded welcome campaign’s first 20-MEZO lock claim, NFT ownership and repeat-claim refusal.
- Android 0.2.4: Added a mobile interface, floating Home/Swap/Wealth navigation, dismissible sheets and browser OAuth return to the app. Restored Privy after logout; removed Telegram and Chrome install prompts. Added Google linking and persistent receipt-email preferences. Fixed wallet/network selection, account caches and button spinners.
- Validation/materials: 145 finance/payment tests and 29 screens at three widths pass. Android build, signing and live APK checks pass. Updated README, recovery/testing docs and ten-slide deck.

Track 2: Access and Distribution for MUSD/MEZO. Proposed merchant fees fund gas/operations; users currently pay BTC gas. No revenue or independent adoption is claimed. Evidence is testnet; device/account flows remain unverified. Receipt email delivery is not configured.
