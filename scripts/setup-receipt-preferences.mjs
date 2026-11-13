import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
const db = new PrismaClient({ log: [] });
try {
  const before = { users: await db.user.count(), payments: await db.payment.count(), invoices: await db.paymentRequest.count() };
  if (process.argv.includes("--apply")) {
    const sql = await readFile("prisma/sql/2026-11-06-receipt-preferences.sql", "utf8");
    await db.$executeRawUnsafe(sql);
  }
  const rows = await db.$queryRaw`SELECT to_regclass('public.receipt_preferences') IS NOT NULL AS exists`;
  const after = { users: await db.user.count(), payments: await db.payment.count(), invoices: await db.paymentRequest.count() };
  const result = { createdAt: new Date().toISOString(), applied: process.argv.includes("--apply"), tableExists: rows[0].exists, before, after, accountDataModified: false };
  await writeFile("docs/evidence/receipt-preferences-database.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally { await db.$disconnect(); }
