-- Additive migration for direct receipts and merchant requests. No receipt deletion.
-- Each statement is separated by the marker for the reviewed rollout script.
DO $$ BEGIN
  CREATE TYPE "PaymentMode" AS ENUM ('UNCLASSIFIED', 'LEGACY_VAULT', 'DIRECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- statement
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
-- statement
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
-- statement
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'LATE_PAID';
-- statement
ALTER TABLE users ADD COLUMN IF NOT EXISTS "businessName" varchar(80);
-- statement
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mode "PaymentMode" NOT NULL DEFAULT 'UNCLASSIFIED', ADD COLUMN IF NOT EXISTS "chainId" integer, ADD COLUMN IF NOT EXISTS token text;
-- statement
CREATE INDEX IF NOT EXISTS payments_mode_status_idx ON payments(mode,status);
-- statement
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "intendedPayerAddress" text, ADD COLUMN IF NOT EXISTS "merchantName" text, ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS "settlementKey" text;
-- statement
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_settlementKey_key" ON payment_requests("settlementKey");
-- statement
CREATE INDEX IF NOT EXISTS "payment_requests_intendedPayerAddress_idx" ON payment_requests("intendedPayerAddress");
