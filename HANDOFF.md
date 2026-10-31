# Pocket faucet reset handoff

Source repository: greyw0rks/musd-pocket, main at 8599ebf.
Faucet-only release checkout: /tmp/musd-pocket-faucet-v2.
Local branch: fix/faucet-006-reset; no GitHub push has been performed.

## Completed

- Set testnet allowance to 0.06 BTC and 300 mUSD.
- New round btc-0.06-v2 reopens eligibility for previous claimants once per account.
- Preserved all three original claim records, transaction hashes and timestamps.
- Applied reviewed migration using the user-specified /home/greyw0rks/musd-pocket/.env; never printed credentials.
- Saved private claim backup inside .faucet-backups (ignored by Git and Vercel).
- Deployed to production: dpl_3GcMaB2VmMMhiEvkNgXeGEm4yraV, READY.
- Production aliases: https://mpocket.vercel.app and https://mpocket.tech.
- Six faucet regression tests and focused ESLint checks pass.
- Migration validated twice in PGlite with old receipt preservation and per-round uniqueness.
- TypeScript passed on the existing remediation checkout; the isolated release passed the Vercel production build.
- Funding snapshot: relayer 0xBA46d08B9E298E8E70096Fc238Da207139BCCAB7 has about 0.665 BTC and 19,759 mUSD.

## Follow-up

The source change is committed on the local branch; push/PR has not been requested. Preserve it upstream before a subsequent deployment from unchanged main. A portable git patch is /tmp/pocket-faucet-006-reset.patch.

The broader Wave 1 remediation remains in /home/greyw0rks/musd-pocket-wave1. This release includes only faucet files/schema changes and its verification materials. It does not deploy the MEZO welcome campaign, change welcome eligibility, execute repay/claimYield, or establish external-user/merchant traction. Do not claim those audit gaps are closed.

Atlas start_session failed because its SQLite database could not open, so no Atlas session id exists to close. This file is the local handoff fallback.
