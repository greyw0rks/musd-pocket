// Responsive UI and input-state checks with explicit fixtures; no backend writes or wallet signing.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();
const cssDir = ".next/dev/static/chunks";
const cssFiles = (await readdir(cssDir)).filter((file) =>
  /(app_globals|components_pocket_pocket).*\.css$/.test(file),
);
const css =
  (
    await Promise.all(
      cssFiles.map((file) => readFile(`${cssDir}/${file}`, "utf8")),
    )
  ).join("\n") + (await readFile("components/pocket/pocket.css", "utf8"));
const bundle = await build({
  stdin: {
    contents: `
    import React, {useState} from "react";
    import {createRoot} from "react-dom/client";
    import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
    import {VaultScreen} from "@/components/pocket/earn/VaultScreen";
    import {BorrowScreen} from "@/components/pocket/borrow/BorrowScreen";
    import {OpenTroveScreen} from "@/components/pocket/borrow/OpenTroveScreen";
    import {RepayTroveScreen} from "@/components/pocket/borrow/RepayTroveScreen";
    function App() {
      const [screen, setScreen] = useState("vault");
      const [revision, setRevision] = useState(0);
      window.financeRendered = revision;
      window.showFinance = (value, scenario="funded") => {window.financeScenario=scenario;setRevision(revision+1);setScreen(value);return revision+1};
      return <div className="pocket-root" data-theme="light"><div className="pk-app">
        <QueryClientProvider key={revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
        {screen === "vault" ? <VaultScreen onBack={()=>setScreen("borrow")} /> : screen === "borrow" ? <BorrowScreen onBack={()=>setScreen("vault")} onOpenTrove={()=>setScreen("open")} onRepay={()=>setScreen("repay")} /> : screen === "open" ? <OpenTroveScreen onBack={()=>setScreen("borrow")} onDone={()=>setScreen("borrow")} /> : <RepayTroveScreen onBack={()=>setScreen("borrow")} onDone={()=>setScreen("borrow")} />}
        </QueryClientProvider>
      </div></div>;
    }
    createRoot(document.getElementById("root")).render(<App />);`,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  plugins: [
    {
      name: "finance-fixtures",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(wagmi|@\/hooks\/use-(earn|earn-actions|musd|borrow|borrow-actions))$/,
          },
          () => ({ path: `${root}/scripts/fixtures/finance-browser.mjs` }),
        );
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("https://finance-ui.test/**", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{margin:0}#fixture-label{position:fixed;right:8px;bottom:4px;z-index:100;font:10px sans-serif;color:#777}</style></head><body><div id="root"></div><span id="fixture-label">UI check · fixture data</span></body></html>`,
  }),
);
try {
  await page.goto("https://finance-ui.test");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const show = async (screen, scenario = "funded") => {
    const revision = await page.evaluate(
      ([s, c]) => window.showFinance(s, c),
      [screen, scenario],
    );
    await page.waitForFunction(
      (value) => window.financeRendered === value,
      revision,
    );
    await page.locator(".pk-finance").waitFor();
  };
  const checkLayout = async () => {
    const failures = await page
      .locator(".pk-finance button, .pk-finance input, .pk-finance select")
      .evaluateAll((elements) =>
        elements
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width &&
              (b.left < 0 || b.right > window.innerWidth + 1 || b.height < 32)
            );
          })
          .map((el) => el.outerHTML),
      );
    assert.deepEqual(failures, [], "Controls fit and have usable tap targets");
    assert.equal(
      await page
        .locator(".pk-scr")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
  };
  await page.getByLabel("Amount to save", { exact: true }).waitFor();
  await page.getByLabel("Amount to save", { exact: true }).fill("51");
  assert.equal(
    await page
      .getByRole("button", { name: "Save MUSD", exact: true })
      .isEnabled(),
    false,
  );
  assert.equal(
    await page
      .getByLabel("Amount to save", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  await page
    .getByRole("button", { name: "Use the maximum", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Amount to save", { exact: true }).inputValue(),
    "50",
  );
  await page.getByRole("button", { name: "Take out", exact: true }).click();
  assert.equal(
    await page.getByLabel("Amount to take out", { exact: true }).inputValue(),
    "",
  );
  await page
    .getByRole("button", { name: "Use the maximum", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Amount to take out", { exact: true }).inputValue(),
    "100",
  );
  await page.evaluate(() => {
    window.financeHold = true;
  });
  await page
    .getByRole("button", { name: "Take out MUSD", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Save", exact: true }).isEnabled(),
    false,
  );
  assert.equal(
    await page.getByLabel("Amount to take out", { exact: true }).isEnabled(),
    false,
  );
  await page.getByText(/^Done\./).waitFor();
  await show("vault", "mismatch");
  await page.getByLabel("Amount to save", { exact: true }).fill("2");
  assert.equal(
    await page
      .getByRole("button", { name: "Save MUSD", exact: true })
      .isEnabled(),
    false,
  );
  await show("vault", "unread");
  assert.equal(
    await page
      .getByRole("button", { name: "Claim interest", exact: true })
      .count(),
    0,
  );
  await show("repay", "recovery");
  await page.getByText(/closing is not allowed/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Close position", exact: true })
      .isEnabled(),
    false,
  );
  await show("repay");
  await page.getByLabel("MUSD to repay", { exact: true }).waitFor();
  await page.getByLabel("MUSD to repay", { exact: true }).fill("900");
  assert.equal(
    await page.getByRole("button", { name: "Repay", exact: true }).isEnabled(),
    false,
  );
  await page.getByRole("button", { name: "Max", exact: true }).click();
  assert.equal(
    await page.getByLabel("MUSD to repay", { exact: true }).inputValue(),
    "800",
  );
  await show("borrow", "unread");
  await page.getByText("Not checked", { exact: true }).waitFor();
  assert.equal(await page.getByText("Healthy", { exact: true }).count(), 0);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
    for (const theme of ["light", "dark"]) {
      await page
        .locator(".pocket-root")
        .evaluate((el, t) => (el.dataset.theme = t), theme);
      for (const [screen, scenario] of [
        ["vault", "funded"],
        ["borrow", "funded"],
        ["borrow", "empty"],
        ["open", "funded"],
        ["repay", "funded"],
      ]) {
        await show(screen, scenario);
        if (screen === "open") {
          await page.getByLabel("Bitcoin to lock", { exact: true }).fill("0.1");
          await page.getByLabel("MUSD to borrow", { exact: true }).fill("2500");
        }
        await checkLayout();
        if (width === 390) {
          await page.waitForFunction(() =>
            [...document.querySelectorAll(".pk-finance-hero")].every(
              (el) => Number(getComputedStyle(el).opacity) > 0.99,
            ),
          );
          await page.screenshot({
            path: `/tmp/mpocket-${screen}-${scenario}-${theme}.png`,
            animations: "disabled",
          });
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        fixtureOnly: true,
        viewports: [320, 390, 1280],
        themes: ["light", "dark"],
        screens: ["vault", "borrow", "borrow-empty", "open", "repay"],
        balanceLimits: true,
        busyControls: true,
        mismatchGuard: true,
        unreadYield: true,
        unreadRisk: true,
        recoveryGuard: true,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(errors);
  console.error(await page.locator("body").innerText());
  await page.screenshot({ path: "/tmp/mpocket-finance-failure.png" });
  throw error;
} finally {
  await browser.close();
}
