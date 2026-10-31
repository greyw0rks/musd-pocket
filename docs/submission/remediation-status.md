# Pocket Wave 1 remediation status

Repository: `greyw0rks/musd-pocket`. Review source: branch `fix/wave-1-complete`, preserving the already released faucet change.

Production: https://mpocket.tech and https://mpocket.vercel.app — Vercel READY, deployment `dpl_BUkiyGnXsJ14PjW5PSG6w9mzJn23`. The user approved production publication and the GitHub branch push.

Review deployment: https://musd-pocket-r5ihuraf8-greyw0rks-projects.vercel.app.

| Audit item | Result | Evidence or remaining step |
| --- | --- | --- |
| Protocol integration | Existing Troves and Savings retained | Reviewer recognized protocol correctness; current contract reads and claim simulation succeed |
| Repay | Implementation retained; execution pending | Supplied wallet has a closed Trove, and public history has no repay call. Open/use an active Trove and authorize a partial repay |
| claimYield | False-zero accounting fixed; execution pending | Approximately 187.37 mUSD accrued at the recorded snapshot. User must authorize the actual claim |
| Direct architecture | README corrected; vault mutations retired by default | Wallet signs transfers; API verifies receipt. Old payment, deposit and withdrawal POST routes return 410 |
| Receipt recovery | Implemented | Sender-bound pending intents, merchant polling, optional protected cron, unique chain/hash/log settlement |
| Merchant checkout | Implemented in live app | Merchant profile, invoice, high-entropy link, QR, direct wallet payment and receipt; authenticated end-to-end merchant pilot remains pending |
| Faucet | Existing production release preserved | 0.06 BTC / 300 mUSD, round `btc-0.06-v2`, previous receipts retained and old users eligible once in the new round |
| Welcome MEZO | Testnet campaign deployed and funded; live app configured | 200 MEZO per claim, two weekly epochs; current inventory funds one claim. First authenticated user claim still pending |
| Database | Additive migration applied | Six users, 14 payments and three faucet records preserved; eight historical direct receipts verified, two unclassified after unreadable RPC responses |
| Track | Documented | Track 2: Access and Distribution for MUSD/MEZO |
| Revenue model | Documented hypothesis | Future disclosed merchant fee covering gas; pilot fees are zero and no revenue is claimed |
| Pitch deck | Completed | Eight-slide PDF, editable JSON and printable HTML |
| External adoption | Pilot kit prepared; evidence pending | Recruit genuine independent users and merchants. Empty evidence ledger does not claim traction |

## Validation

40 application regression tests pass, including Savings accrual, authenticated transfer verification, receipt replay, pending-hash handling, cancellation races and welcome/faucet recovery. 25 Foundry unit tests passed, including 14 welcome-contract tests and the existing 11 vault tests. TypeScript and focused lint pass. Vercel compiled and passed TypeScript, then reached READY. The deck renders as eight PDF pages without content overflow. These checks establish implementation quality, not real-user activity.

The optional local browser smoke check did not complete: the localhost stylesheet compiler exceeded the navigation timeout under both local compilers. No successful browser or authenticated merchant pilot is claimed. The remote Vercel build passed independently.

## Operator handoff

Campaign: `0x3469818359ce1bae2d137531dcd78c5cc4ec14ba` on Mezo testnet 31611. [Public rollout receipts](../evidence/welcome-rollout.json). Preserve this deployment to preserve one-time eligibility. Additional welcome claims require additional MEZO inventory; no larger funding budget was assumed.

Private database backups are excluded from Git. No embedded-wallet transactions or outreach messages were signed/sent by the agent. Use the [on-chain checklist](on-chain-verification.md) and [pilot kit](pilot-kit.md) to close the evidence gaps.

Atlas session start failed because its SQLite database was unavailable. This status file serves as the local handoff.
