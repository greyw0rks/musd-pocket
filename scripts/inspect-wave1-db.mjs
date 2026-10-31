import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }, log: [] });
try {
  const columns = await db.$queryRaw`SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('users','payments','payment_requests') ORDER BY table_name, ordinal_position`;
  const enums = await db.$queryRaw`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname IN ('RequestStatus','PaymentMode','UserRole') ORDER BY t.typname,e.enumsortorder`;
  const payments = await db.$queryRaw`SELECT status, (lower("paymentId")=lower("payoutTxHash")) AS direct_hash, count(*)::int AS count FROM payments GROUP BY status,direct_hash`;
  const requests = await db.$queryRaw`SELECT status, ("creatorAddress"="recipientAddress") AS pays_creator, ("txHash" IS NOT NULL) AS has_hash, count(*)::int AS count FROM payment_requests GROUP BY status,pays_creator,has_hash`;
  const report = { checkedAt: new Date().toISOString(), columns, enums, payments, requests };
  await writeFile(new URL('../docs/evidence/wave1-db-inspection.json', import.meta.url), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report));
} catch (error) { console.error(JSON.stringify({ failed: true, errorClass: error.name, code: error.code ?? null })); process.exitCode=1; }
finally { await db.$disconnect(); }
