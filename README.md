# mUSD Pocket

> Create a payment request. Share it. Get paid in mUSD.

A deliberately narrow payments app on **Mezo**: request money, share a link or QR,
the payer sends mUSD, and Pocket independently verifies the on-chain transfer and
flips the request to **Paid**. No custody — funds go wallet-to-wallet.

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind v4
- **wagmi v3 + viem** for wallet + chain reads/writes (injected wallets)
- **TanStack Query** for client data
- **Prisma + PostgreSQL** for request/contact records
- **qrcode** for shareable QR codes

## Mezo config

Single-sourced in `lib/mezo/config.ts`. Switch env with `NEXT_PUBLIC_MEZO_ENV`
(`testnet` default, or `mainnet`).

| Env     | Chain ID | mUSD (18 decimals)                           |
| ------- | -------- | -------------------------------------------- |
| Mainnet | 31612    | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| Testnet | 31611    | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |

> Gas on Mezo is paid in **BTC**, not mUSD. Payers need a little BTC to pay a request.

## Payment verification (the trust boundary)

The frontend only submits a tx hash. The **server** (`lib/mezo/verify.ts`) reads the
chain, parses `Transfer` logs emitted by the mUSD contract, and confirms the recipient
and exact amount before marking a request paid. The client is never trusted.

## Getting started

```bash
pnpm install

# 1. Point DATABASE_URL at your Postgres (Neon) in .env  (see .env.example)
# 2. Create the tables
pnpm exec prisma db push

pnpm dev
```

Open http://localhost:3000.

## Demo flow

1. Wallet A opens Pocket → **Request money** → 25 mUSD → gets a QR / link
2. Wallet B opens the link → connects → **Pay 25 mUSD**
3. Server verifies the Transfer → request shows **✓ Paid** on both sides
