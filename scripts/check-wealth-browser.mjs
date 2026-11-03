// Component smoke test with explicit fixtures; no login, backend writes or signing.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();
const cssFiles = (await readdir(".next/dev/static/chunks")).filter((file) =>
  /(app_globals|components_pocket_pocket).*\.css$/.test(file),
);
const css = (
  await Promise.all(
    cssFiles.map((file) => readFile(`.next/dev/static/chunks/${file}`, "utf8")),
  )
).join("\n");
const bundle = await build({
  stdin: {
    contents: `
    import React, {useState} from "react";
    import {createRoot} from "react-dom/client";
    import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
    import {WealthScreen, LockScreen, PoolsScreen} from "@/components/pocket/wealth/WealthScreen";
    import {SwapScreen} from "@/components/pocket/wealth/SwapScreen";
    import {MerchantProfile} from "@/components/pocket/profile/MerchantProfile";
    import {FloatingNav} from "@/components/pocket/navigation/FloatingNav";
    function App() {
      const [screen, setScreen] = useState("wealth");
      return <div className="pocket-root" data-theme="light" data-screen={screen}><div className="pk-app" style={{height:"100vh"}}>
        {screen === "wealth" ? <WealthScreen onVault={()=>setScreen("vault")} onLocks={()=>setScreen("locks")} onPools={()=>setScreen("pools")} /> :
         screen === "locks" ? <LockScreen onBack={()=>setScreen("wealth")} /> :
         screen === "pools" ? <PoolsScreen onBack={()=>setScreen("wealth")} /> :
         screen === "swap" ? <SwapScreen /> :
         screen === "home" ? <div className="pk-scr"><MerchantProfile /></div> : <div className="pk-scr"><h1>Savings destination</h1></div>}
        {screen === "wealth" || screen === "home" || screen === "swap" ? <FloatingNav active={screen} onChange={setScreen} /> : null}
      </div></div>;
    }
    createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App /></QueryClientProvider>);
  `,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_MEZO_ENV": '"testnet"',
    "process.env.NEXT_PUBLIC_MEZO_RPC_URL": '""',
  },
  plugins: [
    {
      name: "isolated-fixtures",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(wagmi|@\/(lib\/auth\/session|components\/pocket\/store)|\.\.?\/musd)$/,
          },
          () => ({ path: `${root}/scripts/fixtures/wealth-browser.mjs` }),
        );
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.route("https://pocket-ui.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{margin:0}.pk-app{position:relative;width:100%;max-width:480px;margin:auto}.pk-scr{padding-top:44px}#fixture-label{position:fixed;top:4px;left:8px;z-index:100;font:11px sans-serif;color:#666}</style></head><body><span id="fixture-label">Component test · fixture data</span><div id="root"></div></body></html>`,
    }),
  );
  await page.goto("https://pocket-ui.test");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole("heading", { name: "Wealth", exact: true }).waitFor();
  assert.deepEqual(
    await page
      .locator(".pk-nav button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      ),
    ["Home", "Swap", "Wealth"],
  );
  assert.equal(
    await page
      .locator(".pk-nav")
      .evaluate((el) => getComputedStyle(el).display),
    "flex",
  );
  await page.screenshot({
    path: "/tmp/pocket-wealth-mobile.png",
    fullPage: true,
  });
  const dialog = page.getByRole("dialog");
  const calls = () => page.evaluate(() => window.fixtureTransactions);
  const closeReview = async () => {
    await dialog.getByRole("button", { name: /^(Close|Done)$/ }).click();
    await dialog.waitFor({ state: "hidden" });
  };
  await page.getByRole("button", { name: /Lock Create/ }).click();
  await page.getByText("Permanent lock", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link").count(), 0);
  await page.screenshot({
    path: "/tmp/pocket-locks-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("MEZO amount", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Review new lock" }).click();
  await dialog
    .getByRole("button", { name: "Approve 20 MEZO", exact: true })
    .waitFor();
  assert.deepEqual(await calls(), []);
  await dialog
    .getByRole("button", { name: "Approve 20 MEZO", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create lock", exact: true })
    .waitFor();
  assert.deepEqual(await calls(), ["approve"]);
  await page.evaluate(() => {
    window.failRefresh = true;
  });
  await dialog
    .getByRole("button", { name: "Create lock", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  assert.deepEqual(await calls(), ["approve", "createLock"]);
  await closeReview();
  // Existing locks are managed here, including the long permanent unlock.
  await page.getByRole("button", { name: "Start unlock", exact: true }).click();
  await dialog.getByText(/does not withdraw your MEZO/).waitFor();
  await closeReview();
  await page.getByRole("button", { name: "Manage #43", exact: true }).click();
  await page.getByLabel("MEZO to add to #43").fill("2");
  await page.getByRole("button", { name: "Review added MEZO" }).click();
  await dialog
    .getByRole("button", { name: "Add to lock", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  await closeReview();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  await page
    .getByRole("button", { name: "Review extension", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Extend lock", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  await closeReview();
  await page
    .locator("li")
    .filter({ hasText: "#44" })
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Withdraw MEZO", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  await closeReview();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Pools Add/ }).click();
  await page.getByText("Your liquidity", { exact: true }).waitFor();
  for (const name of ["Add", "Remove", "Fees"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    assert.ok(
      box && box.x >= 0 && box.x + box.width <= 390,
      `${name} fits the mobile screen`,
    );
  }
  assert.equal(await page.getByRole("link").count(), 0);
  await page.getByLabel("mUSD to deposit").fill("10");
  assert.equal(await page.getByLabel("BTC to deposit").inputValue(), "0.001");
  await page.getByRole("button", { name: "Review deposit" }).waitFor();
  await page.screenshot({
    path: "/tmp/pocket-pools-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review deposit" }).click();
  await dialog
    .getByRole("button", { name: "Approve 10 mUSD", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Approve 0.001 BTC", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Add liquidity", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/pocket-pool-review-mobile.png",
    fullPage: true,
  });
  // A timeout retains the hash; navigating away and back recovers without signing.
  await page.evaluate(() => {
    window.fixtureMode = "pending";
  });
  await dialog
    .getByRole("button", { name: "Add liquidity", exact: true })
    .click();
  await dialog.getByText(/Transaction sent/).waitFor();
  const sent = (await calls()).length;
  await closeReview();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Pools Add/ }).click();
  await page
    .getByRole("button", { name: "Check confirmation", exact: true })
    .click();
  await page.evaluate(() => {
    window.fixtureMode = "success";
  });
  await dialog
    .getByRole("button", { name: "Check confirmation", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  assert.equal((await calls()).length, sent);
  await closeReview();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "50%", exact: true }).click();
  assert.equal(await page.getByLabel("LP tokens to remove").inputValue(), "5");
  await page.getByRole("button", { name: "Review withdrawal" }).click();
  await dialog
    .getByRole("button", { name: "Approve 5 LP", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Remove liquidity", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  await closeReview();
  await page.getByRole("button", { name: "Fees", exact: true }).click();
  await page.getByRole("button", { name: "Review fee claim" }).click();
  await page.evaluate(() => {
    window.fixtureMode = "unknown";
  });
  await dialog
    .getByRole("button", { name: "Claim pool fees", exact: true })
    .click();
  await dialog
    .getByText("The submission result is unknown.", { exact: true })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Clear unsent request" })
      .isEnabled(),
    false,
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Clear unsent request" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.evaluate(() => {
    window.fixtureMode = "success";
  });
  await page.getByRole("button", { name: "Review fee claim" }).click();
  await dialog
    .getByRole("button", { name: "Claim pool fees", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  await closeReview();
  assert.deepEqual(await calls(), [
    "approve",
    "createLock",
    "increaseAmount",
    "increaseUnlockTime",
    "withdraw",
    "approve",
    "approve",
    "addLiquidity",
    "approve",
    "removeLiquidity",
    "claimFees",
  ]);
  await page.getByLabel("Pool", { exact: true }).selectOption("musd-usdc");
  await page.getByLabel("mUSDC to deposit").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByLabel("Account type").selectOption("merchant");
  await page.getByLabel("Business name", { exact: true }).fill("Test shop");
  await page.evaluate(() => {
    window.failSave = true;
  });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Could not save profile" })
    .waitFor();
  assert.equal(await page.getByText(/Profile saved/).count(), 0);
  await page.evaluate(() => {
    window.failSave = false;
  });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Profile saved" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.lastProfile), {
    accountType: "merchant",
    businessName: "Test shop",
  });
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  await page.getByRole("heading", { name: "Swap", exact: true }).waitFor();
  await page.getByLabel("You pay (mUSD)", { exact: true }).fill("2");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent === "Review swap" && !button.disabled,
    ),
  );
  await page.waitForTimeout(450); // Let the dock's transition settle for its screenshot.
  for (const label of ["Home", "Swap", "Wealth"]) {
    assert.equal(
      await page.locator(".pk-nav span").filter({ hasText: label }).isVisible(),
      true,
    );
  }
  await page.screenshot({
    path: "/tmp/pocket-swap-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review swap", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Swap mUSD for BTC", exact: true })
    .waitFor();
  await dialog.getByText("Minimum received", { exact: true }).waitFor();
  await dialog
    .getByRole("button", { name: "Swap mUSD for BTC", exact: true })
    .click();
  await dialog.getByText("Transaction confirmed.", { exact: true }).waitFor();
  assert.equal((await calls()).at(-1), "swapExactTokensForTokens");
  await closeReview();
  await page
    .getByRole("button", { name: "Switch direction", exact: true })
    .click();
  await page.getByLabel("You pay (BTC)", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("You pay (BTC)", { exact: true }).inputValue(),
    "",
  );
  await page.setViewportSize({ width: 320, height: 780 });
  const navBox = await page.locator(".pk-nav").boundingBox();
  assert.ok(
    navBox && navBox.x >= 0 && navBox.x + navBox.width <= 320,
    "Navigation fits a narrow phone",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Wealth", exact: true }).click();
  await page.getByRole("button", { name: /Vault Save/ }).click();
  await page
    .getByRole("heading", { name: "Savings destination", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        fixtureOnly: true,
        wealthNavigation: true,
        navigationOrder: ["Home", "Swap", "Wealth"],
        inAppSwap: true,
        inAppLockLifecycle: true,
        inAppPoolLifecycle: true,
        approvalsRequireSeparateConfirmation: true,
        pendingRecoveryWithoutSigning: true,
        uncertainSubmissionRequiresExplicitClear: true,
        merchantFailureAndSuccess: true,
        pageErrors: errors,
        screenshot: "/tmp/pocket-wealth-mobile.png",
      },
      null,
      2,
    ),
  );
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: "/tmp/pocket-wealth-browser-failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser.close();
}
