CREATE TABLE faucet_claims ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL,"walletAddress" TEXT NOT NULL,"btcTxHash" TEXT,"musdTxHash" TEXT,"completedAt" TIMESTAMP(3));
CREATE UNIQUE INDEX "faucet_claims_userId_key" ON faucet_claims ("userId");
INSERT INTO faucet_claims VALUES ('old-complete','fixture-alice','0xfixturealice','old-btc','old-musd','2026-10-20'), ('old-partial','fixture-bob','0xfixturebob','old-partial-btc',NULL,NULL);
CREATE TEMP TABLE original_claims AS TABLE faucet_claims;
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

INSERT INTO faucet_claims VALUES ('new-alice','fixture-alice','0xfixturealice',NULL,NULL,NULL,'btc-0.06-v2'),('new-bob','fixture-bob','0xfixturebob',NULL,NULL,NULL,'btc-0.06-v2');
DO $test$ BEGIN
IF (SELECT count(*) FROM faucet_claims WHERE round='legacy-0.015')<>2 THEN RAISE EXCEPTION 'Legacy claims changed'; END IF;
IF EXISTS (SELECT * FROM original_claims EXCEPT SELECT id,"userId","walletAddress","btcTxHash","musdTxHash","completedAt" FROM faucet_claims WHERE round='legacy-0.015') THEN RAISE EXCEPTION 'Original receipt data changed'; END IF;
BEGIN
INSERT INTO faucet_claims VALUES ('duplicate','fixture-alice','0xfixturealice',NULL,NULL,NULL,'btc-0.06-v2');
RAISE EXCEPTION 'Duplicate claim was allowed';
EXCEPTION WHEN unique_violation THEN NULL;
END;
END $test$;
SELECT round,count(*) AS claims FROM faucet_claims GROUP BY round ORDER BY round;
