# mPocket Android 0.2.4

Download: https://mpocket.tech/downloads/mpocket-0.2.4.apk

Install over the existing app. Package `tech.mpocket.testing`, versionCode 6, minimum Android API 24, original signing certificate.

- Home, Swap and Wealth have the floating pill navigation again, with side margins, safe-area spacing and 46px controls.
- mUSD and native BTC reads target the authenticated Pocket wallet on the configured Mezo chain. Vault, Borrow, BTC sends, Swap and other Wealth signing clients are restricted to that same wallet and network. Privy activates the embedded wallet named by the session and switches it to Mezo. A wrong or stale client is reported as unavailable rather than used to read an empty wallet.
- Vault and Borrow position caches include wallet and chain; Vault also includes its contract address. Logging out or changing accounts cannot reuse the previous account's position.
- Vault accounting retains the protocol's 1:1 principal and separate stored plus index-accrued interest. Unknown yield stays unknown. Small interest amounts remain visible at full mUSD precision.
- Fresh and recovered interest claims verify sender, vault, calldata, receipt and positive mUSD Transfer logs from the vault to the owner. The success amount comes from the actual receipt, rather than the simulation preview. Missing payout evidence keeps the pending hash and blocks another signature; a proven revert clears it. Same-tab and cross-tab claim locks remain in place.
- Vault, Borrow and BTC actions recheck the provider account, provider chain, RPC chain and current client before preflight and immediately before signing, including between a deposit approval and deposit.
- Transaction buttons use an explicit 16px spinner with a 2px border. Standalone loading indicators keep their large size.

The prior login, merchant, receipt preference and weekly activity features remain in this release. See [0.2.3 notes](android-0.2.3-handoff.md). Automatic receipt email delivery remains unconfigured.

Validation: TypeScript and scoped ESLint, finance/backend tests, real-hook browser fixtures for two-wallet activation/network/cache changes, nine floating-dock layouts at 320/390/640px and actual tab clicks, Vault loading and precise payout display, all existing mobile screen fixtures, Android assembly/lint, original-certificate signing, 16KiB alignment and byte comparison of every packaged web asset. Historical payouts of 187.366117347141378 and 0.00228183663115 mUSD were independently recovered through the new verifier without signing.

Evidence is in `docs/evidence/android/finance-ui-0.2.4.json`, `session-wallet-0.2.4.json`, `vault-claims-0.2.4.json`, `apk-0.2.4-build.json` and `docs/evidence/android-0.2.4-release.json`. Screenshots are saved beside the UI evidence.

Physical Android installation and real account transactions remain untested. The wallet mismatch is reproduced with fixture connectors; no affected user's device or account was inspected. No real login, payment, signature or message was performed during these checks.
