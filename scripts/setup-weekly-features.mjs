// Additive tables only. Never edits accounts, payment records or balances.
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
const db = new PrismaClient({ log: [] });
const tables = ["weekly_activity", "referral_codes", "referrals", "merchant_coupons"];
try {
  const applied = process.argv.includes("--apply");
  const before = { users: await db.user.count(), payments: await db.payment.count(), invoices: await db.paymentRequest.count() };
  if (applied) {
    const sql = await readFile(new URL("../prisma/sql/2026-11-06-weekly-tasks-and-merchants.sql", import.meta.url), "utf8");
    const statements = sql.split(";").map(value => value.trim()).filter(value => value && !["BEGIN", "COMMIT"].includes(value));
    await db.$transaction(async transaction => { for (const statement of statements) await transaction.$executeRawUnsafe(statement); });
  }
  const existence = {};
  for (const table of tables) {
    const rows = await db.$queryRaw`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS exists`;
    existence[table] = rows[0].exists;
  }
  const after = { users: await db.user.count(), payments: await db.payment.count(), invoices: await db.paymentRequest.count() };
  const report = { capturedAt: new Date().toISOString(), applied, tables: existence, before, after, financialBroadcasts: 0 };
  if (applied) await writeFile("docs/evidence/weekly-features-database.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
