import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(new URL("../docs/submission/pitch-deck.html", import.meta.url).href);
  await page.emulateMedia({ media: "print" });
  const slides = await page.locator(".slide").count();
  if (slides !== 8) throw new Error("Expected eight slides");
  const overflow = await page.locator(".slide").evaluateAll(nodes => nodes.some(node => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth));
  if (overflow) throw new Error("Deck has overflowing content");
  await page.pdf({ path: fileURLToPath(new URL("../docs/submission/pitch-deck.pdf", import.meta.url)), printBackground: true, preferCSSPageSize: true });
  console.log(JSON.stringify({ slides, overflow, pdf: "docs/submission/pitch-deck.pdf" }));
} finally { await browser.close(); }
