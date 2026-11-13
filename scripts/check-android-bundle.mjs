// Exercise the exact production APK assets at their HTTPS origin. No login, wallet writes or signing.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assets = path.resolve("apps/android/app/src/main/assets/web");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 13; SM-N981B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/136.0.7103.87 Mobile Safari/537.36",
});
const page = await context.newPage();
const errors = [];
const networkFailures = [];
page.on("pageerror", error => errors.push(error.message));
page.on("requestfailed", request => {
  const url = new URL(request.url());
  networkFailures.push({ endpoint: url.origin + url.pathname, error: request.failure()?.errorText });
});
page.on("response", response => {
  if (response.status() < 400) return;
  const url = new URL(response.url());
  networkFailures.push({ endpoint: url.origin + url.pathname, status: response.status() });
});
const mime = { ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".woff2": "font/woff2", ".html": "text/html" };
await context.route("https://mpocket.tech/**", async route => {
  const url = new URL(route.request().url());
  const relative = url.pathname === "/home" || url.pathname.startsWith("/pay/") ? "index.html" : url.pathname.startsWith("/_android/web/") ? url.pathname.slice("/_android/web/".length) : null;
  if (relative === null) return route.continue();
  const file = path.resolve(assets, relative);
  if (!file.startsWith(assets + path.sep)) return route.abort();
  try { await route.fulfill({ body: await readFile(file), contentType: mime[path.extname(file)] ?? "application/octet-stream" }); }
  catch { await route.abort(); }
});

const checks = {};
try {
  await page.goto("https://mpocket.tech/home");
  await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 60_000 });
  checks.bundledSignInRenders = true;
  const loginButton = await page.getByRole("button", { name: "Continue", exact: true }).boundingBox();
  assert.ok(loginButton && loginButton.height >= 44 && loginButton.width > 250, "Bundled layout styles give the login button a usable touch target");
  assert.ok(loginButton.x > 0 && loginButton.x + loginButton.width < 391, "Login controls fit the phone width");
  checks.layoutStylesBundled = true;
  assert.equal(await page.getByText("Add Pocket to your home screen", { exact: true }).count(), 0);
  checks.noInstallGate = true;
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByPlaceholder(/email/i).waitFor({ timeout: 30_000 });
  checks.livePrivyLoginDialog = true;
  await mkdir("docs/evidence/android", { recursive: true });
  await page.screenshot({ path: "docs/evidence/android/bundled-login.png" });
  await context.setOffline(true);
  await page.getByText(/You’re offline/).waitFor();
  checks.offlineNotice = true;
  await context.setOffline(false);
  await page.waitForFunction(() => document.querySelector(".connection-status").hidden);
  checks.reconnectClearsNotice = true;
  await page.goto("https://mpocket.tech/pay/not-a-valid-id!");
  await page.getByText("This payment link is invalid.", { exact: true }).waitFor({ timeout: 60_000 });
  checks.invalidDeepLinkRejectedBeforeAuth = true;
  assert.deepEqual(errors, []);
  checks.pageErrors = errors;
  await writeFile("docs/evidence/android/bundle-smoke.json", JSON.stringify({ createdAt: new Date().toISOString(), checks, androidWebViewUserAgentSimulated: true, accountLoginPerformed: false, transactionSigningPerformed: false }, null, 2) + "\n");
  console.log(JSON.stringify(checks, null, 2));
} catch (failure) {
  console.error(JSON.stringify({ pageErrors: errors, networkFailures, visibleText: await page.locator("body").innerText() }, null, 2));
  await page.screenshot({ path: "/tmp/mpocket-android-bundle-failure.png" });
  throw failure;
} finally { await browser.close(); }
