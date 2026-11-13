# mPocket Android 0.2.1

Install this update over Pocket Test or mPocket 0.2.0, then use the same linked identity. Package `tech.mpocket.testing`, version code 3 and the original signing certificate are retained.

Download: https://mpocket.tech/downloads/mpocket-0.2.1.apk

Twitter authentication stays in the app's WebView and returns to bundled Home or payment checkout with its OAuth state and PKCE verifier preserved. The Send screen includes verified merchant offers: a persistent random 10–30% Greylabs merch discount per account, a new Greylabs merch enquiry page, and Pocket's existing mainnet pilot waitlist. The waitlist uses 100 testnet mUSD and does not activate mainnet.

After the welcome claim, Rewards shows a weekly checklist: send mUSD to five different friends, invite three new accounts, borrow, repay, add to a pool, swap mUSD and lock MEZO. Tasks are checked automatically using confirmed receipts and attributed signups. Weeks reset Monday at 00:00 UTC. Approvals, merchants, self-transfers and unrelated calls do not count as friend sends. This checklist adds no token payout.

The additive database migration is installed. The live builder-account scan completed without a syncing warning and confirmed the existing borrow, repay, pool and swap activity. It did not create activity or broadcast transactions.

Validation: 75 wealth/rewards/merchant tests and 68 checkout tests pass; TypeScript and changed-file ESLint pass. The APK's 253 assets exactly match the tested bundle. Android lint reports zero errors and 18 warnings. APK alignment and v2/v3 signatures pass with the original certificate. Mobile merchant/rewards fixtures pass at 320px and 390px. OAuth fixtures use the actual bundled Privy SDK, retain PKCE and payment return, and reject wrong state. The packaged sign-in UI connects to live Privy and passes offline/reconnection and invalid-link checks.

The signed APK is 3,123,085 bytes. SHA-256: `4aace9a1ca2c10fd3a093c8969a3ae3d73fee7d8335ea546a55a62ab11eb0ffd`.

Actual phone installation and Twitter account authentication remain unverified; OAuth provider responses were mocked in the regression checks. Device acceptance should cover installing the update and signing in with the existing X identity. No real account login, financial signing, payment or message sending was performed during this feature validation. Production deployment details are recorded separately in `docs/evidence/android-0.2.1-release.json` after publication.
