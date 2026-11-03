-- Additive only. Review/apply through the normal database migration process.
-- users.role already exists. businessName is already present on the inspected DB.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "businessName" VARCHAR(80);

CREATE TABLE IF NOT EXISTS "welcome_reward_attempts" (
  "id" TEXT PRIMARY KEY,
  "chainId" INTEGER NOT NULL,
  "campaign" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'SENDING',
  "txHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "welcome_reward_attempts_chainId_campaign_walletAddress_key"
ON "welcome_reward_attempts" ("chainId", "campaign", "walletAddress");
