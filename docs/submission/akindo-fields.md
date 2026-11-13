# Pocket — AKINDO Wave 2 text fields

Updated 13 November 2026. These fields describe Android 0.2.5 and the Mezo Testnet release. Keep the existing pitch video as requested.

## Project name

Pocket (mPocket)

## Project category

Social payments and checkout

## TL;DR

Pocket lets Bitcoin holders borrow MUSD on Mezo and spend it through social payments and merchant checkout from one embedded wallet.

## How it works

Mezo gives Bitcoin holders access to spending money without selling their BTC. Pocket connects that MUSD to everyday recipients and merchants through social sign-in, usernames, invoices and QR checkout.

Users sign in with X or email through Privy. Their embedded wallet holds their spendable mUSD and BTC, and the user signs each direct wallet-to-wallet mUSD transfer. Pocket verifies the configured chain, sender, token, recipient, exact amount, calldata, successful receipt and matching Transfer event. It records the paid invoice and Activity together. Saved hashes let users check an uncertain payment without signing another transfer; a proof cannot settle two invoices.

The same wallet opens, repays and closes BTC-backed Mezo Troves, deposits into Savings, claims actual mUSD interest, swaps through verified pools, manages liquidity and controls BTC locks. Vault claims prepare fees before wallet confirmation and recover an uncertain response using its saved hash or nonce. New locks use Mezo's veBTC contract; previous MEZO positions remain accessible. Weekly tasks use confirmed activity and qualifying referrals, including BTC locks. The welcome reward has ended because the testnet faucet already supplies starting funds.

Merchant checkout gives MUSD a payment destination. Business profiles receive directly into their own wallets. The Greylabs offer unlocks one persistent 10–30% discount after a confirmed positive mUSD payment. Pocket's 100-testnet-mUSD mainnet waitlist checkout reuses the payer's invoice and recovers pending/completed payments; the payment does not activate mainnet access. The verified first payment is a builder test. Independent customer purchases, fulfillment, feedback and repeat use remain the next pilot milestone.

The payer currently supplies BTC gas. Proposed disclosed merchant fees could fund operations and future gas support, with reporting/reconciliation tools following pilot demand. Pocket fee collection and revenue are not implemented. Testnet balances, builder payments and fixture screens are not presented as independent adoption or mainnet revenue.

## Target group

Bitcoin holders who want to access MUSD through Mezo and use it for payments, plus small merchants receiving MUSD. The product is mobile first and uses familiar social sign-in for users who do not want to manage seed phrases and separate DeFi interfaces. The initial pilot focuses on users and merchant operators in the Mezo community; no regional adoption is claimed.

## Tech stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Privy embedded wallets and authentication, wagmi, viem, Mezo Borrow/Savings/DEX/veBTC contracts, Prisma, PostgreSQL (Neon), Vercel, QR tooling, Motion, and an Android Java/Gradle app with a Vite-built mobile client. Existing veMEZO positions retain lifecycle controls.

## Track

Track 2: Access and Distribution for MUSD/MEZO.

## Chain deployed on

Mezo — Testnet, chain ID 31611.

## Project status

An existing Wave 1 project with new Wave 2 features. Existing product: https://mpocket.tech/home. Wave 2 adds merchant distribution, weekly tasks, broader Mezo asset management, BTC locks, verified repayment/interest recovery and Android 0.2.5. The full change list is in [the Wave 2 update](submission.md).

## Project readiness

Testnet deployment. All financial evidence is Mezo Testnet. Physical Android account/signing flows remain unverified, and automatic receipt-email delivery is not configured.

## Future milestones

1. **November 16–30, 2026:** complete a merchant pilot with independent customers and Android account acceptance. Record settled invoices, fulfillment, exact feedback and return use. One merchant and two independent customers are planning targets.
2. **December 1–15, 2026:** improve merchant settlement/reporting and validate a disclosed fee model against measured gas, operations and support costs.
3. **December 16, 2026–January 15, 2027:** prepare a limited Mezo Mainnet pilot using verified recovery/protocol integrations. Use merchant results to decide launch scope.

## Team info

Solo builder: Greyw0rks — product, engineering and design. GitHub: https://github.com/greyw0rks. X: https://x.com/Greyw0rks.

## Submission links

- App: https://mpocket.tech/home
- Android 0.2.5: https://mpocket.tech/downloads/mpocket-0.2.5.apk
- Product deck: https://mpocket.tech/pitch-deck.pdf
- Public repository: https://github.com/greyw0rks/musd-pocket
- [Chain and validation evidence](evidence.md)
- [Merchant pilot record](pilot-record.md)

Use AKINDO's displayed deadline and retain the platform confirmation when these text fields are updated.
