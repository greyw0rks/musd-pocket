-- Additive checkout schema for databases created from the older Pocket schema.
-- Review against the target database before applying. The existing Pocket
-- database already has these columns, enum values, and indexes; this session
-- did not run DDL or backfill existing records.

DO $$ BEGIN
  CREATE TYPE "PaymentMode" AS ENUM ('UNCLASSIFIED', 'LEGACY_VAULT', 'DIRECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'LATE_PAID';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "mode" "PaymentMode" NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN IF NOT EXISTS "chainId" INTEGER,
  ADD COLUMN IF NOT EXISTS "token" TEXT;

ALTER TABLE "payment_requests"
  ADD COLUMN IF NOT EXISTS "intendedPayerAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "merchantName" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "settlementKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_settlementKey_key"
  ON "payment_requests" ("settlementKey");
CREATE INDEX IF NOT EXISTS "payment_requests_intendedPayerAddress_idx"
  ON "payment_requests" ("intendedPayerAddress");
