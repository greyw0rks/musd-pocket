// Actual app screens and store with fixture sessions/APIs. No account login or financial signing.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();
const assets = "apps/android/app/src/main/assets/web/assets";
const chunks = await readdir(assets);
const css = (await Promise.all(chunks.filter(f => f.endsWith(".css")).map(f => readFile(`${assets}/${f}`, "utf8")))).join("\n");
const fixture = await readFile("scripts/fixtures/mobile-session-ui.tsx", "utf8");
const bundle = await build({
  stdin: { contents: `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PocketApp} from '@/components/pocket/PocketApp';import {AuthGate} from '@/components/auth-gate';import {PrivyOAuthReturn} from '@/components/auth/PrivySignIn';import {ReceiptGoogleSync} from '@/lib/receipts/google-client';import {services,FixtureLogin} from 'fixture-root';document.documentElement.dataset.pocketRuntime='android';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PrivyOAuthReturn/><ReceiptGoogleSync/><AuthGate><PocketApp services={services}/></AuthGate><FixtureLogin/></QueryClientProvider>);`, loader: "tsx", resolveDir: root },
  bundle: true, write: false, jsx: "automatic", format: "iife", define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_MEZO_ENV": '"testnet"', "process.env.NEXT_PUBLIC_MEZO_RPC_URL": '""' },
  plugins: [{ name: "fixtures", setup(b) {
    b.onResolve({ filter: /^(fixture-root|wagmi|next\/link|@privy-io\/react-auth|@\/lib\/auth\/(session|client)|@\/lib\/wallet\/privy|@\/hooks\/.*)$/ }, () => ({ path: "fixture", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: fixture, loader: "tsx", resolveDir: root }));
    b.onLoad({ filter: /components\/pocket\/store\.tsx$/ }, async args => ({ contents: (await readFile(args.path, "utf8")).replace('return <Ctx.Provider value={value}>', 'window.fixturePocket = value; return <Ctx.Provider value={value}>'), loader: "tsx", resolveDir: root + "/components/pocket" }));
  } }],
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("https://mpocket-app.test/**", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}</style><div id="root"></div>` }));
await page.route("**/*", route => route.request().url().startsWith("https://mpocket-app.test/") ? route.fallback() : route.abort());
const open = async (query = '') => { await page.goto("https://mpocket-app.test/home" + query); await page.addScriptTag({ content: bundle.outputFiles[0].text }); await page.waitForFunction(() => window.fixturePocket?.ready); };
const navigate = async id => { await page.evaluate(id => window.fixturePocket.reset(id), id); await page.waitForFunction(id => document.querySelector(`[data-screen="${id}"]`), id); await page.waitForTimeout(180); };
const checks = {};
try {
  await open();
  const ids = (await readFile("components/pocket/navigation/ids.ts", "utf8")).split("export interface")[0].match(/"([a-z-]+)"/g).map(value => JSON.parse(value));
  for (const width of process.argv.includes('--flows-only') ? [] : [320, 390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    for (const id of ids) {
      await navigate(id);
      const layout = await page.locator(".pk-app").evaluate(el => { const rect = el.getBoundingClientRect(); return { width: rect.width, height: rect.height, scroll: document.documentElement.scrollWidth }; });
      assert.equal(layout.width, width, `${id} fills the Android viewport`);
      assert.equal(Math.round(layout.height), 844, `${id} uses the app height`);
      assert.ok(layout.scroll <= width, `${id} does not overflow horizontally`);
      assert.equal(await page.getByText("Sign in or create account", { exact: true }).count(), 0);
    }
  }
  if (!process.argv.includes('--flows-only')) checks.appScreenLayouts = { count: ids.length, widths: [320, 390, 640] };
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate("home");
  assert.equal(await page.getByText("Pocket mainnet access", { exact: true }).count(), 0);
  await navigate("contacts");
  assert.equal(await page.getByText("Pocket mainnet access", { exact: true }).count(), 1);
  checks.waitlistOnlyUnderVerifiedMerchants = true;
  await navigate("profile");
  await page.getByRole("button", { name: /Receipts/ }).click();
  const receipts = page.getByRole("dialog", { name: "Receipts", exact: true });
  await receipts.getByPlaceholder("you@example.com").fill("owner@example.com");
  await page.evaluate(() => window.fixtureFailReceipt = true);
  await receipts.getByRole("button", { name: "Use this address" }).click();
  await receipts.getByText("Receipt address could not be saved.").waitFor();
  await page.evaluate(() => window.fixtureFailReceipt = false);
  await receipts.getByRole("button", { name: "Use this address" }).click();
  await receipts.waitFor({ state: "hidden" });
  await page.getByText("owner@example.com", { exact: true }).waitFor();
  await open(); await navigate("profile");
  await page.getByText("owner@example.com", { exact: true }).waitFor();
  checks.enteredEmailPersistsAfterReloadAndFailedSaveIsRetryable = true;
  await page.getByRole("button", { name: /Receipts/ }).click();
  await receipts.getByRole("button", { name: "Connect Google" }).click();
  await receipts.waitFor({ state: "hidden" });
  await page.getByText("owner@gmail.com", { exact: true }).waitFor();
  assert.equal(await page.getByText("alex.morgan@gmail.com", { exact: true }).count(), 0);
  checks.googleLinkSavesActualAccountAddress = true;
  await page.getByRole("button", { name: /Receipts/ }).click();
  await page.setViewportSize({ width: 390, height: 420 });
  await receipts.getByPlaceholder("you@example.com").focus();
  await page.waitForFunction(() => { const rect = document.querySelector('[role="dialog"][aria-label="Receipts"]').getBoundingClientRect(); return rect.y >= 0 && rect.bottom <= innerHeight + 1; }, null, { timeout: 5000 });
  const rect = await receipts.boundingBox(); assert.ok(rect.y >= 0 && rect.y + rect.height <= 421);
  assert.equal(await page.evaluate(() => window.__pocketAndroidBack()), true);
  await receipts.waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-screen]").getAttribute("data-screen"), "profile");
  checks.smallViewportAndNativeBackCloseSheet = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Receipts/ }).click();
  await receipts.getByRole("button", { name: "Remove", exact: true }).click();
  await receipts.waitFor({ state: "hidden" });
  await page.getByText("Not set", { exact: true }).waitFor();
  checks.receiptPreferenceCanBeRemoved = true;
  await open('?privy_oauth_state=fixture-state'); await navigate('profile');
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const signout = page.getByRole("dialog", { name: "Sign out?", exact: true });
  await page.evaluate(() => window.fixtureFailLogout = true);
  await signout.getByRole("button", { name: "Sign out", exact: true }).click();
  await signout.getByRole("alert").waitFor();
  await page.evaluate(() => window.fixtureFailLogout = false);
  await signout.getByRole("button", { name: "Sign out", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Fixture Privy chooser" });
  await chooser.waitFor();
  assert.equal(await page.getByText("Sign in or create account", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.fixtureLoginCount), 1);
  await chooser.getByRole("button", { name: "Close chooser" }).click();
  await page.waitForTimeout(200);
  assert.equal(await chooser.count(), 0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await chooser.waitFor();
  assert.equal(await page.evaluate(() => window.fixtureLoginCount), 2);
  checks.signoutOpensPrivyOnceAndDismissedChooserCanReopen = true;
  checks.signoutAfterOAuthReturnOpensPrivy = true;
  assert.deepEqual(errors, []);
  await mkdir("docs/evidence/android", { recursive: true });
  await writeFile("docs/evidence/android/mobile-app-screen-check.json", JSON.stringify({ createdAt: new Date().toISOString(), checks, sessionAndWalletReadsMocked: true, accountLoginPerformed: false, transactionSigningPerformed: false }, null, 2) + "\n");
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  console.error(JSON.stringify({ errors, screen: await page.evaluate(() => window.fixturePocket?.current?.id), geometry: await page.evaluate(() => [...document.querySelectorAll('.pocket-root,.pk-app,[role="dialog"]')].map(el => ({ className: el.className, rect: el.getBoundingClientRect().toJSON(), height: getComputedStyle(el).height, maxHeight: getComputedStyle(el).maxHeight, transform: getComputedStyle(el).transform, viewport: innerHeight }))) }, null, 2));
  throw error;
} finally { await browser.close(); }
