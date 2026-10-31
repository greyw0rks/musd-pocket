-- Reopen the testnet faucet at 0.06 BTC + 300 mUSD per account.
-- Apply this reviewed migration before deploying the v2 faucet API.
-- Old claims, transaction hashes and completion dates remain unchanged.
-- Idempotent; do not delete claim rows or use db push against the drifted live DB.
BEGIN;

ALTER TABLE "faucet_claims"
  ADD COLUMN IF NOT EXISTS "round" TEXT NOT NULL DEFAULT 'legacy-0.015';

CREATE UNIQUE INDEX IF NOT EXISTS "faucet_claims_userId_round_key"
  ON "faucet_claims" ("userId", "round");

-- Replace the previous global per-user index with per-round uniqueness.
DROP INDEX IF EXISTS "faucet_claims_userId_key";

COMMIT;
