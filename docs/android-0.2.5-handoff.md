# mPocket Android 0.2.5

Download: https://mpocket.tech/downloads/mpocket-0.2.5.apk

Install over the existing app. Package `tech.mpocket.testing`, versionCode 7, minimum Android API 24, original signing certificate.

Published November 13 through [PR #19](https://github.com/greyw0rks/musd-pocket/pull/19), public main commit `3096e5c`. Canonical deployment `dpl_B5ga9KZ2o3JUfyMB6s7gj7fLSj9P` is Ready. The live APK, checksum, PDF, HTML deck and domain association match the release files. The APK is 3,139,763 bytes with SHA-256 `de8b74d91927599b6cf03cc1abc1561e6ddf0f66977ab5d1baf6c07fbc305cad`. [Canonical release checks](evidence/wave-2-canonical-release-2026-11-13.json).

- Vault interest claims prepare gas, price and the nonce before wallet confirmation. An error after confirmation keeps the claim recoverable instead of saying nothing left the wallet. Known hashes verify the actual mUSD payout; a lost hash can be located through the reserved nonce. Check claim confirmation signs nothing. An explicit retry reuses the original nonce, and a claim that finishes before the retry is recovered first.
- New locks use BTC through Mezo's veBTC contract. Create, top up, extend and withdraw eligible positions. Testnet durations are limited to 30 days with weekly rounding. Starting a permanent BTC unlock sets its withdrawal date up to 30 days away.
- The Existing MEZO tab retains the ownership, extension and withdrawal controls for previous positions. Those permanent locks keep their 208-week unlock rules.
- The welcome reward has ended. Home opens Weekly tasks immediately, including the BTC lock task. Starting funds come from the existing testnet faucet; tasks do not promise a weekly token payout.

Validation and release checks are recorded in [the Android evidence](evidence/android/validation-0.2.5.json), [BTC contract readiness](evidence/btc-lock-readiness-2026-11-12.json) and [live release evidence](evidence/android-0.2.5-release.json). BTC lifecycle tests use deployed veBTC code on a local fork with a fixture token. They do not create a live BTC lock. Physical Android account/signing flows remain unverified.

The prior login, merchant checkout, receipt preferences, account caches and floating Home/Swap/Wealth dock remain available. Automatic receipt email delivery is not configured. See [0.2.4 notes](android-0.2.4-handoff.md).
