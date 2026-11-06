// Read-only production checks. No real OAuth grant, login, payment or signing.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const downloadUrl = "https://mpocket.tech/downloads/mpocket-0.2.2.apk";
const expected = await readFile("public/downloads/mpocket-0.2.2.apk");
const download = await fetch(downloadUrl);
assert.equal(download.status, 200);
const received = Buffer.from(await download.arrayBuffer());
const sha256 = createHash("sha256").update(expected).digest("hex");
assert.equal(createHash("sha256").update(received).digest("hex"), sha256);
const association = await (await fetch("https://mpocket.tech/.well-known/assetlinks.json")).json();
assert.ok(association.some(item => item.target?.package_name === "tech.mpocket.testing" &&
  item.target.sha256_cert_fingerprints?.some(value => value.replaceAll(":", "").toLowerCase() === "34608cce75a2e10318587090b7cab6acd5aaac3b4507dd09c0fcd6e76056b57c")));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
// Use Node's working HTTP transport for production bytes in this WSL browser.
await page.route("https://mpocket.tech/**", async route => {
  const response = await fetch(route.request().url());
  const headers = Object.fromEntries(response.headers);
  delete headers["content-encoding"];
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
});
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  const callback = await page.goto("https://mpocket.tech/auth/android?privy_oauth_code=fixture-code&privy_oauth_state=fixture-state&privy_oauth_provider=twitter", { waitUntil: "commit" });
  assert.equal(callback.status(), 200);
  assert.equal(callback.headers()["cache-control"], "no-store");
  await page.getByRole("link", { name: "Return to mPocket" }).waitFor();
  assert.ok((await page.getByRole("link", { name: "Return to mPocket" }).getAttribute("href")).includes("package=tech.mpocket.testing"));
  assert.equal(new URL(page.url()).search, "");
  assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
  await page.goto("https://mpocket.tech/auth/android");
  await page.getByText(/Sign-in wasn’t completed/).waitFor();
  await page.goto("https://mpocket.tech/home");
  await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 60_000 });
  assert.equal(await page.getByText(/Add Pocket to your home screen|install.*chrome/i).count(), 0);
  assert.deepEqual(errors, []);
  const result = {
    createdAt: new Date().toISOString(), sourceCommit: "5e76922", downloadUrl,
    deploymentId: process.env.MPOCKET_DEPLOYMENT_ID ?? null,
    versionName: "0.2.2", versionCode: 4, apkBytes: received.length, sha256,
    checks: { liveDownloadMatchesSignedApk: true, signingCertificateAssociationPresent: true,
      callbackPageReturnsToAndroidPackage: true, callbackStripsQueryFromHistory: true,
      callbackHasNoManifest: true, incompleteCallbackExplained: true, webHomeHasNoInstallGate: true },
    productionBrowserTransport: "Node HTTP forwards actual production bytes into Chromium",
    actualAndroidDeviceTested: false, accountLoginPerformed: false, transactionSigningPerformed: false,
  };
  await writeFile("docs/evidence/android-0.2.2-release.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
