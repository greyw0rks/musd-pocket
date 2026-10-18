-- Additive schema changes for the App Store release of Pocket.
--
-- Run against the live database with:
--
--   npx prisma db execute --file prisma/sql/2026-10-18-avatar-and-asset.sql \
--     --schema prisma/schema.prisma
--
-- Why a hand-written file instead of `prisma db push`: the live database has
-- drifted from `prisma/schema.prisma` (see the retired claim columns and
-- `merchant_profiles`), and `db push --accept-data-loss` would resolve that
-- drift by dropping data. These three statements only add, and each is
-- idempotent, so running the file twice is harmless.

-- `Withdrawal.asset` — distinguishes a BTC transfer from the older vault
-- release of MUSD. Every existing row was a MUSD release, which is exactly what
-- the default says, so the backfill is the default.
DO $$
BEGIN
  CREATE TYPE "AssetKey" AS ENUM ('MUSD', 'BTC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "asset" "AssetKey" NOT NULL DEFAULT 'MUSD';

-- `User.avatarUrl` — the X profile picture, refreshed at every sign-in. Null
-- is meaningful: non-X accounts and rows written before this column existed.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
