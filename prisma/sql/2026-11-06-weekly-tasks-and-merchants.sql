BEGIN;
CREATE TABLE IF NOT EXISTS "weekly_activity" (
  "id" TEXT PRIMARY KEY, "chainId" INTEGER NOT NULL, "txHash" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL, "kind" TEXT NOT NULL, "counterparty" TEXT,
  "confirmedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_activity_chainId_txHash_key" ON "weekly_activity" ("chainId", "txHash");
CREATE INDEX IF NOT EXISTS "weekly_activity_walletAddress_chainId_confirmedAt_idx" ON "weekly_activity" ("walletAddress", "chainId", "confirmedAt");
CREATE TABLE IF NOT EXISTS "referral_codes" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id"), "code" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "referrals" (
  "invitedId" TEXT PRIMARY KEY REFERENCES "users"("id"), "inviterId" TEXT NOT NULL REFERENCES "users"("id"),
  "joinedAt" TIMESTAMP(3) NOT NULL, CHECK ("invitedId" <> "inviterId")
);
CREATE INDEX IF NOT EXISTS "referrals_inviterId_joinedAt_idx" ON "referrals" ("inviterId", "joinedAt");
CREATE TABLE IF NOT EXISTS "merchant_coupons" (
  "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL REFERENCES "users"("id"),
  "merchant" TEXT NOT NULL, "percent" INTEGER NOT NULL CHECK ("percent" BETWEEN 10 AND 30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
