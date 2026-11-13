// Read-only aggregate snapshot and verification of the existing builder invoice.
// Load the intended database environment with node --env-file; no signing.
import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";

const output = process.argv[2] ?? "docs/evidence/wave-2-pilot-snapshot-2026-11-12.json";
const db = new PrismaClient({ log: [] });
const builderWallet = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
const merchantWallet = "0x0a5e59ca4f182561de80172c6da5db927091ea29";
const expectedHash = "0x056b918e9620de6ef203312880f6dc6872e8db71ac2d7edf59c58f074a363195";
try {
  const report = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [roles, completedFaucets, payments, invoices, firstInvoice, tables] = await Promise.all([
      tx.user.groupBy({ by: ["role"], _count: { _all: true } }),
      tx.faucetClaim.count({ where: { completedAt: { not: null } } }),
      tx.payment.groupBy({ by: ["mode", "status"], _count: { _all: true } }),
      tx.paymentRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      tx.paymentRequest.findUnique({
        where: { shortId: "89YAGVPYD8ZXYE6FJWZUK652" },
        select: { shortId: true, chainId: true, token: true, amount: true, status: true,
          creatorAddress: true, recipientAddress: true, payerAddress: true,
          merchantName: true, txHash: true, paidAt: true, createdAt: true },
      }),
      tx.$queryRawUnsafe("SELECT to_regclass('public.weekly_activity') IS NOT NULL AS weekly_activity, to_regclass('public.referral_codes') IS NOT NULL AS referral_codes, to_regclass('public.referrals') IS NOT NULL AS referrals, to_regclass('public.merchant_coupons') IS NOT NULL AS merchant_coupons, to_regclass('public.receipt_preferences') IS NOT NULL AS receipt_preferences"),
    ]);
    const ledger = firstInvoice?.txHash ? await tx.payment.findUnique({
      where: { paymentId: firstInvoice.txHash },
      select: { mode: true, chainId: true, token: true, status: true, amount: true,
        recipientAddress: true, payoutTxHash: true, paidAt: true },
    }) : null;
    const builderInvoiceConfirmed = firstInvoice?.status === "PAID"
      && firstInvoice.txHash === expectedHash && firstInvoice.payerAddress === builderWallet
      && firstInvoice.creatorAddress === merchantWallet && firstInvoice.recipientAddress === merchantWallet
      && firstInvoice.amount.equals("100") && firstInvoice.chainId === 31611;
    const atomicPaymentRecordMatches = ledger?.mode === "DIRECT" && ledger.status === "PAID"
      && ledger.payoutTxHash === expectedHash && ledger.recipientAddress === merchantWallet
      && ledger.chainId === 31611 && ledger.amount.equals("100")
      && ledger.token === firstInvoice?.token && ledger.paidAt !== null;
    return {
      capturedAt: new Date().toISOString(), databaseReadOnly: true,
      usersByRole: roles.map(row => ({ role: row.role, count: row._count._all })),
      completedFaucets,
      payments: payments.map(row => ({ mode: row.mode, status: row.status, count: row._count._all })),
      invoicesByStatus: invoices.map(row => ({ status: row.status, count: row._count._all })),
      requiredTables: tables[0],
      firstInvoice: firstInvoice ? { ...firstInvoice, amount: firstInvoice.amount.toFixed() } : null,
      builderInvoiceConfirmed, atomicPaymentRecordMatches,
      classification: "Builder-operated testnet payment; independent customer demand is not established.",
      independentCustomerEvidenceProvided: false, fulfillmentEvidenceProvided: false,
      customerFeedbackProvided: false, financialBroadcasts: 0, databaseWrites: 0,
    };
  }, { maxWait: 10000, timeout: 30000 });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.builderInvoiceConfirmed || !report.atomicPaymentRecordMatches
      || Object.values(report.requiredTables).some(value => value !== true)) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ error: "Read-only pilot snapshot did not complete", kind: error.name,
    code: error.errorCode ?? error.code ?? null, databaseConfigured: Boolean(process.env.DATABASE_URL),
    directUrlConfigured: Boolean(process.env.DIRECT_URL) }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
