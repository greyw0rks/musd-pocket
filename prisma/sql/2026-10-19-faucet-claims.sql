-- One-time testnet faucet claims.
--
-- Run against the live database with:
--
--   npx prisma db execute --file prisma/sql/2026-10-19-faucet-claims.sql \
--     --schema prisma/schema.prisma
--
-- Additive only. The live database has drifted from `prisma/schema.prisma`
-- (retired claim columns, `merchant_profiles`), so `db push` — and especially
-- `--accept-data-loss` — must never be pointed at it. Every statement below is
-- idempotent, so running the file twice is harmless.

CREATE TABLE IF NOT EXISTS "faucet_claims" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "btcTxHash" TEXT,
  "musdTxHash" TEXT,
  "error" TEXT,
  "claimingAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faucet_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "faucet_claims_userId_key"
  ON "faucet_claims" ("userId");

-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; the catalog check is the
-- equivalent. RESTRICT matches Prisma's default for a required relation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'faucet_claims_userId_fkey'
  ) THEN
    ALTER TABLE "faucet_claims"
      ADD CONSTRAINT "faucet_claims_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
