// Real Privy SDK with separate WebView/browser storage and mocked OAuth endpoints.
// No provider credentials, real authorization grants, login, wallets or signing.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assets = path.resolve("apps/android/app/src/main/assets/web");
const browser = await chromium.launch({ headless: true });
const checks = {};
const mime = { ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".woff2": "font/woff2", ".html": "text/html" };

async function scenario({ name, routePath, wrongState = false, cancelRetry = false, coldReturn = false, provider = "twitter" }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-N981B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/136.0.7103.87 Mobile Safari/537.36",
  });
  let page = await context.newPage();
  const tabContext = await browser.newContext();
  const tab = await tabContext.newPage();
  let prepared;
  await context.exposeBinding("prepareOAuth", async (_source, value) => { prepared = JSON.parse(value); });
  await context.addInitScript(() => {
    window.PocketNative = {
      onmessage: null,
      postMessage: async message => {
        const data = JSON.parse(message);
        if (data.action === "prepareOAuth") await window.prepareOAuth(data.value);
        window.PocketNative.onmessage?.({ data: JSON.stringify({ id: data.id, result: "ready" }) });
      },
    };
  });
  const errors = [];
  const navigation = [];
  let init;
  let authenticate;
  let providerVisited = false;
  const providerUrl = provider === "telegram" ? "https://oauth.telegram.org/auth?fixture=1" : "https://x.com/i/oauth2/authorize?fixture=1";
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
    assert.equal(init.provider, provider);
    assert.equal(init.redirect_to, "https://mpocket.tech/auth/android");
    assert.ok(init.code_challenge && init.state_code, "SDK must prepare PKCE and state");
    await route.fulfill({ json: { url: providerUrl } });
  });
  await context.route(new URL(providerUrl).origin + "/**", route => route.abort());
  await tabContext.route(new URL(providerUrl).origin + "/**", async route => {
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
    await page.getByPlaceholder(/email/i).waitFor({ timeout: 60_000 });
    assert.equal(await page.getByRole("button", { name: /telegram/i }).count(), 0, "Telegram removed from login");
    const twitter = page.getByRole("button", { name: provider === "telegram" ? /telegram/i : /twitter|continue with x|log in with x/i });
    await twitter.click({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    assert.ok(prepared, "Native auth prepared before provider navigation");
    assert.equal(new URL(page.url()).pathname, routePath, "WebView stays on original route");
    await tab.goto(prepared.authorizationUrl);
    assert.deepEqual(await tab.evaluate(() => Object.keys(localStorage)), [], "Browser does not receive WebView PKCE storage");
    if (cancelRetry) {
      const oldState = prepared.state;
      await page.goto(prepared.returnUrl);
      await page.getByPlaceholder(/email/i).waitFor();
      await page.getByRole("button", { name: provider === "telegram" ? /telegram/i : /twitter|continue with x|log in with x/i }).click();
      await page.waitForTimeout(1000);
      assert.notEqual(prepared.state, oldState, "Retry supersedes cancelled authorization");
    }
    if (coldReturn) {
      const storage = await context.storageState();
      await page.close();
      page = await context.newPage();
      await page.addInitScript(origins => {
        const origin = origins.find(item => item.origin === location.origin);
        for (const item of origin?.localStorage ?? []) localStorage.setItem(item.name, item.value);
      }, storage.origins);
    }
    const authenticationResponse = wrongState ? null : page.waitForResponse(response => response.url().includes("/api/v1/oauth/authenticate"), { timeout: 30_000 });
    // Native validation is covered by PocketOAuthTest. Relay only callback fields
    // into the original app route, never the browser session or verifier.
    const callback = new URL(prepared.returnUrl);
    callback.searchParams.set("privy_oauth_code", "fixture-code");
    callback.searchParams.set("privy_oauth_state", wrongState ? "wrong-fixture-state" : init.state_code);
    callback.searchParams.set("privy_oauth_provider", provider);
    await page.goto(callback.href);
    if (wrongState) {
      await page.getByText(/unexpected auth flow|phishing|something went wrong|authentication failed/i).first().waitFor({ timeout: 30_000 });
      assert.equal(authenticate, undefined, "Mismatched state must not reach authentication");
    } else {
      await authenticationResponse;
      assert.equal(authenticate.authorization_code, "fixture-code");
      assert.equal(authenticate.state_code, init.state_code);
      assert.equal(createHash("sha256").update(authenticate.code_verifier).digest("base64url"), init.code_challenge, "Original WebView PKCE verifier must survive provider and callback navigation");
    }
    assert.ok(providerVisited);
    assert.equal(new URL(page.url()).pathname, routePath);
    assert.deepEqual(errors, []);
    assert.equal(await page.getByText(/install.*(chrome|home screen)/i).count(), 0, "No Chrome installation gate");
    checks[name] = true;
  } catch (error) {
    // Do not log callback URLs, storage, authorization codes or verifier values.
    console.error({ scenario: name, initReceived: Boolean(init), providerVisited, navigation, pageErrors: errors, visibleText: await page.locator("body").innerText() });
    throw error;
  } finally { await context.close(); await tabContext.close(); }
}

try {
  await scenario({ name: "homeCallbackRetainsPkceAndState", routePath: "/home" });
  await scenario({ name: "paymentCallbackRetainsCheckout", routePath: "/pay/89YAGVPYD8ZXYE6FJWZUK652" });
  await scenario({ name: "wrongStateRejected", routePath: "/home", wrongState: true });
  await scenario({ name: "cancelledSignInCanRetry", routePath: "/home", cancelRetry: true });
  await scenario({ name: "coldReturnRetainsPkce", routePath: "/pay/89YAGVPYD8ZXYE6FJWZUK652", coldReturn: true });
  await mkdir("docs/evidence/android", { recursive: true });
  await writeFile("docs/evidence/android/oauth-regression.json", JSON.stringify({ createdAt: new Date().toISOString(), checks, sdk: "actual bundled Privy", androidNavigationSimulated: true, providerEndpointsMocked: true, accountLoginPerformed: false, transactionSigningPerformed: false }, null, 2) + "\n");
  console.log(JSON.stringify(checks, null, 2));
} finally { await browser.close(); }
