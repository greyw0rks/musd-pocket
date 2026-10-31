import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = "http://127.0.0.1:3097";
const id = "A".repeat(26);
const browser = await chromium.launch({ headless: true });
const report = { fixtureData: true, signedOrBroadcastTransactions: false, cases: [] };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  let invoice = { shortId: id, creatorAddress: "0x1111111111111111111111111111111111111111", recipientAddress: "0x1111111111111111111111111111111111111111", intendedPayerAddress: null, merchantName: "Pilot checkout fixture", amount: "25", token: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503", chainId: 31611, description: "Layout test only", status: "PENDING", txHash: null, payerAddress: null, expiresAt: null, createdAt: new Date().toISOString(), paidAt: null };
  await page.route(`**/api/checkout/${id}`, route => route.fulfill({ json: invoice }));
  await page.goto(`${base}/pay/${id}`, { timeout: 120_000, waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Pilot checkout fixture" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Sign in to Pocket" }).waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Mobile checkout overflows horizontally");
  report.cases.push("Public invoice renders amount, merchant and sign-in on a 390px viewport without overflow");
  invoice = { ...invoice, status: "EXPIRED" };
  await page.reload({ waitUntil: "domcontentloaded" }); await page.getByText("This request is expired.").waitFor();
  if (await page.getByRole("button", { name: /^Pay / }).count()) throw new Error("Expired invoice offers payment");
  report.cases.push("Expired invoice does not offer a new payment");
  invoice = { ...invoice, status: "PAID", txHash: `0x${"a".repeat(64)}` };
  await page.reload({ waitUntil: "domcontentloaded" }); await page.getByRole("heading", { name: "Payment received" }).waitFor();
  await page.getByRole("link", { name: /^View transaction / }).waitFor();
  report.cases.push("Paid invoice shows receipt and explorer link");
  for (const route of ["payments", "deposits", "withdrawals"]) {
    const response = await page.request.post(`${base}/api/${route}`, { data: {} });
    if (response.status() !== 410) throw new Error(`Legacy ${route} POST is not retired`);
  }
  report.cases.push("All three legacy vault mutations return 410 before authentication or settlement");
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.length}`);
  report.runtimeErrors = 0;
  await writeFile(new URL("../docs/evidence/checkout-smoke.json", import.meta.url), JSON.stringify(report, null, 2)+'\n');
  await page.screenshot({ path: fileURLToPath(new URL("../docs/evidence/checkout-layout-fixture.png", import.meta.url)) });
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
