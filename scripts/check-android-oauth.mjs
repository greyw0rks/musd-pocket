// Real bundled Privy SDK, simulated Android navigation and mocked OAuth endpoints.
// No Twitter credentials, real authorization grants, login, wallets or signing.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assets = path.resolve("apps/android/app/src/main/assets/web");
const browser = await chromium.launch({ headless: true });
const checks = {};
const mime = { ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".woff2": "font/woff2", ".html": "text/html" };

async function scenario({ name, routePath, wrongState = false }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-N981B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/136.0.7103.87 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  const errors = [];
  const navigation = [];
  let init;
  let authenticate;
  let providerVisited = false;
  page.on("pageerror", error => errors.push(error.message));
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) { const url = new URL(frame.url()); navigation.push({ host: url.hostname, path: url.pathname }); } });
  await context.route("https://mpocket.tech/**", async route => {
    const url = new URL(route.request().url());
    const relative = url.pathname === "/home" || url.pathname.startsWith("/pay/") ? "index.html" : url.pathname.startsWith("/_android/web/") ? url.pathname.slice("/_android/web/".length) : null;
    if (relative === null) return route.continue();
    const file = path.resolve(assets, relative);
    if (!file.startsWith(assets + path.sep)) return route.abort();
    await route.fulfill({ body: await readFile(file), contentType: mime[path.extname(file)] ?? "application/octet-stream" });
  });
  await context.route("**/api/v1/oauth/init", async route => {
    init = route.request().postDataJSON();
    assert.equal(init.provider, "twitter");
    assert.equal(new URL(init.redirect_to).pathname, routePath);
    assert.ok(init.code_challenge && init.state_code, "SDK must prepare PKCE and state");
    await route.fulfill({ json: { url: "https://x.com/i/oauth2/authorize?fixture=1" } });
  });
  await context.route("https://x.com/**", async route => {
    providerVisited = true;
    await route.fulfill({ contentType: "text/html", body: "<p>Mock identity provider</p>" });
  });
  await context.route("**/api/v1/oauth/authenticate", async route => {
    authenticate = route.request().postDataJSON();
    // Deliberate failure ends the fixture before any authenticated user/wallet.
    await route.fulfill({ status: 400, json: { error: "Fixture stops before account login", code: "invalid_data" } });
  });
  try {
    await page.goto("https://mpocket.tech" + routePath);
    await page.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60_000 });
    const twitter = page.getByRole("button", { name: /twitter|continue with x|log in with x/i });
    const authenticationResponse = wrongState ? null : page.waitForResponse(response => response.url().includes("/api/v1/oauth/authenticate"), { timeout: 30_000 });
    await twitter.click({ timeout: 30_000 });
    await page.waitForURL(url => ["x.com", "twitter.com"].includes(url.hostname), { waitUntil: "commit", timeout: 30_000 });
    providerVisited = true;
    // Simulate the provider returning a grant to the SAME WebView context.
    const callback = new URL(init.redirect_to);
    callback.searchParams.set("privy_oauth_code", "fixture-code");
    callback.searchParams.set("privy_oauth_state", wrongState ? "wrong-fixture-state" : init.state_code);
    callback.searchParams.set("privy_oauth_provider", "twitter");
    await page.goto(callback.href);
    if (wrongState) {
      await page.getByText(/unexpected auth flow|phishing|something went wrong|authentication failed/i).first().waitFor({ timeout: 30_000 });
      assert.equal(authenticate, undefined, "Mismatched state must not reach authentication");
    } else {
      await authenticationResponse;
      assert.equal(authenticate.authorization_code, "fixture-code");
      assert.equal(authenticate.state_code, init.state_code);
      assert.equal(createHash("sha256").update(authenticate.code_verifier).digest("base64url"), init.code_challenge, "Original WebView PKCE verifier must survive Twitter and callback navigation");
    }
    assert.ok(providerVisited);
    assert.equal(new URL(page.url()).pathname, routePath);
    assert.deepEqual(errors, []);
    checks[name] = true;
  } catch (error) {
    // Do not log callback URLs, storage, authorization codes or verifier values.
    console.error({ scenario: name, initReceived: Boolean(init), providerVisited, navigation, pageErrors: errors, visibleText: await page.locator("body").innerText() });
    throw error;
  } finally { await context.close(); }
}

try {
  await scenario({ name: "homeCallbackRetainsPkceAndState", routePath: "/home" });
  await scenario({ name: "paymentCallbackRetainsCheckout", routePath: "/pay/89YAGVPYD8ZXYE6FJWZUK652" });
  await scenario({ name: "wrongStateRejected", routePath: "/home", wrongState: true });
  await mkdir("docs/evidence/android", { recursive: true });
  await writeFile("docs/evidence/android/oauth-regression.json", JSON.stringify({ createdAt: new Date().toISOString(), checks, sdk: "actual bundled Privy", androidNavigationSimulated: true, providerEndpointsMocked: true, accountLoginPerformed: false, transactionSigningPerformed: false }, null, 2) + "\n");
  console.log(JSON.stringify(checks, null, 2));
} finally { await browser.close(); }
