import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Anonymous smoke test: never signs in, creates invoices, or moves funds.
const origin = process.env.POCKET_TEST_ORIGIN || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const home = await page.goto(`${origin}/home`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  assert.equal(home.status(), 200);

  const path = `/pay/${"A".repeat(24)}`;
  const checkout = await page.goto(`${origin}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  assert.equal(checkout.status(), 200);
  try {
    await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 45_000 });
  } catch (error) {
    console.error(JSON.stringify({ pageErrors: errors, visibleText: (await page.locator("body").innerText()).slice(0, 1800) }));
    await page.screenshot({ path: "/tmp/pocket-browser-failure.png", fullPage: true });
    throw error;
  }
  assert.equal(
    new URL(page.url()).pathname,
    path,
    "Checkout must retain its invoice URL through the sign-in gate",
  );
  assert.equal(
    await page.getByText("Add to Home Screen", { exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: "/tmp/pocket-checkout-mobile.png",
    fullPage: true,
  });

  const anonymous = await page.request.get(
    `${origin}/api/requests/${"A".repeat(24)}`,
  );
  assert.equal(
    anonymous.status(),
    401,
    "Invoice API must still require authentication",
  );
  for (const endpoint of ["record", "recover"]) {
    const response = await page.request.post(`${origin}/api/payments/${endpoint}`, { data: {} });
    assert.equal(response.status(), 401, `Payment ${endpoint} must require authentication`);
  }
  for (const method of ["get", "post"]) {
    const response = await page.request[method](`${origin}/api/rewards/welcome`);
    assert.equal(response.status(), 401, `Welcome reward ${method} must require authentication`);
  }
  const profilePatch = await page.request.patch(`${origin}/api/users/me`, { data: { accountType: "merchant", businessName: "Anonymous must fail" } });
  assert.equal(profilePatch.status(), 401, "Merchant profile updates must require authentication");
  const invalid = await page.goto(`${origin}/pay/invalid-id`, {
    waitUntil: "domcontentloaded",
  });
  // Next returns 200 for a streamed not-found response and 404 otherwise.
  assert.ok([200, 404].includes(invalid.status()));
  await page.getByRole("heading", { name: "404", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Continue", exact: true }).count(),
    0,
  );
  assert.deepEqual(
    errors,
    [],
    "Browser must not report uncaught application errors",
  );
  console.log(
    JSON.stringify(
      {
        home: home.status(),
        checkout: checkout.status(),
        invoiceUrlPreserved: true,
        anonymousInvoice: anonymous.status(),
        pageErrors: errors,
        screenshot: "/tmp/pocket-checkout-mobile.png",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
