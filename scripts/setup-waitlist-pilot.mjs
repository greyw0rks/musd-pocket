// Prepare the explicitly requested testnet invoice; --apply creates it once.
import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { writeFile } from "node:fs/promises";
const db = new PrismaClient({ log: [] });
const wallet = "0x0a5e59ca4f182561de80172c6da5db927091ea29";
const description = "Pocket closed-mainnet waitlist (Mezo testnet pilot)";
const token = "0x118917a40faf1cd7a13db0ef56c86de7973ac503";
try {
  const merchant = await db.user.findUnique({ where: { username: "musd_pocket" }, select: { xHandle: true, walletAddress: true, role: true, businessName: true } });
  if (merchant?.xHandle?.toLowerCase() !== "musd_pocket" || merchant.walletAddress !== wallet || merchant.role !== "MERCHANT" || merchant.businessName !== "Pocket") throw new Error("The approved merchant identity/profile differs.");
  const apply = process.argv.includes("--apply");
  let invoice = await db.paymentRequest.findFirst({ where: { creatorAddress: wallet, description, amount: "100", token, chainId: 31611, version: 2 }, orderBy: { createdAt: "asc" } });
  let created = false;
  if (!invoice && apply) {
    invoice = await db.paymentRequest.create({ data: { shortId: customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 24)(), creatorAddress: wallet, recipientAddress: wallet, merchantName: "Pocket", version: 2, amount: "100", token, chainId: 31611, description } });
    created = true;
  }
  const report = { capturedAt: new Date().toISOString(), applied: apply, created, merchant: "Pocket", xHandle: "musd_pocket", merchantWallet: wallet, offer: description, amountMusd: "100", chainId: 31611, invoice: invoice ? { shortId: invoice.shortId, url: `https://mpocket.tech/pay/${invoice.shortId}`, status: invoice.status, expiresAt: invoice.expiresAt, txHash: invoice.txHash } : null, financialBroadcasts: 0, independentCustomerUseProved: false };
  if (apply) await writeFile("docs/evidence/wave-2-waitlist-pilot.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
