CREATE TABLE IF NOT EXISTS "receipt_preferences" (
  "walletAddress" TEXT PRIMARY KEY,
  "channel" VARCHAR(10) NOT NULL CHECK ("channel" IN ('google', 'email')),
  "address" VARCHAR(254) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
