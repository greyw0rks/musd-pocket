# Payment links and QR checkout

The working app is `musd-pocket`. `musd-pocket-wave1` is report/reference material.

## Try it locally

Run `pnpm dev --hostname 127.0.0.1 --port 3000` and open
http://localhost:3000/home. Sign in, open Requests, enter an amount, and choose
**Create payment link**. A contact is optional: **Anyone with the link** works
for customers, or select a contact to restrict payment to their Pocket wallet.
The business/display name and note are optional. Links created in the app expire
after seven days.

The request detail shows a copyable URL and a real QR code for `/pay/<id>`.
The code uses the origin you opened Pocket on. A `localhost` QR works only on
that same device; testing with another phone requires a reachable app origin.
Use the phone's camera to open the QR, or paste the URL into Pocket's Scan page.
The Scan page does not contain a camera scanner.

Checkout retains the invoice URL during sign-in and does not require installing
the PWA. It shows the exact amount, recipient wallet, network, description,
expiry, and optional merchant name. The merchant name is supplied by the
requester and is not a verified business identity.

The payer's embedded wallet signs a direct mUSD transfer. The payer needs mUSD
and BTC for gas on the configured Mezo network (testnet by default). Payment
does not call the legacy vault or change ledger balances.

## Confirmation and recovery

- New links use 24 random characters and version 2. The recipient is always the
  authenticated creator. Old version 1 links cannot start a new payment.
- Before signing, checkout refreshes the invoice and rejects closed, expired,
  paid, incompatible, self-addressed, or already-processing requests.
- The client saves the transaction hash immediately after signing. A reload or
  confirmation retry submits that hash again; it does not sign another payment.
  Browser Web Locks and storage notifications coordinate tabs where supported.
- The server verifies the RPC network, transaction signer, token, calldata,
  exact recipient/amount, successful receipt, and matching Transfer log.
  Transfers mined before invoice creation are rejected.
- An unknown hash does not reserve the invoice. A readable matching transfer
  without a receipt reserves it as `PROCESSING`. A confirmed revert releases
  only the matching payer's reservation.
- Confirmation and the `DIRECT` / `PAID` Activity record commit in one database
  transaction. A unique chain/transaction key prevents proof reuse across links.
  Same-proof retries are idempotent. Funds received after expiry appear as
  `LATE_PAID`, rather than being presented as unpaid.
- **Already sent a payment?** lets the payer submit an existing transaction hash.
  If a wallet replaces a pending transaction, keep both hashes; a bound invoice
  requires investigation before its reservation can safely be released.

A direct ERC-20 transfer has no invoice ID or on-chain invoice lock. Two wallets
or devices can still broadcast payments simultaneously before either is visible
to the server. One proof is recorded; this flow cannot prevent or refund a second
on-chain transfer. A single successful receipt is the confirmation policy here;
finality-depth checks and reorg monitoring are not implemented.

## Schema and checks

The current database already has the checkout fields and unique settlement-key
index (verified read-only). Do not run `prisma db push` against it: there are
other live-schema differences outside this checkout change. An additive SQL
script is provided at `prisma/sql/2026-11-02-payment-link-checkout.sql` for review
when upgrading an older database. No existing payments are reclassified.

```sh
pnpm install --frozen-lockfile
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm test:checkout
node scripts/check-checkout-browser.mjs
```

The checkout tests mock database/RPC boundaries and exercise real calldata/log
encoding. The browser smoke test is anonymous and never sends a transaction.
A signed-in, funded-wallet end-to-end transfer remains a separate manual check.
