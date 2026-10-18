import assert from "node:assert/strict";
import {
  formatAssetAmount,
  formatSignedAssetAmount,
  parseAssetAmount,
} from "./asset-amount.ts";

/*
  What this file is defending.

  `amountUnits` is an integer whose unit is named by a different field, and the
  two units it can be are 10¹⁶ apart. Every mistake available here is silent:
  neither a wrong parser nor a wrong formatter throws, and both produce a figure
  that prints cleanly and looks reasonable. So the cases below are mostly about
  the *pair* being right, not about either half.
*/

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

console.log("\nMUSD — hundredths of a dollar");
check("parses a decimal amount", () =>
  assert.equal(parseAssetAmount("MUSD", "12.34"), 1234n));
check("parses a whole amount", () =>
  assert.equal(parseAssetAmount("MUSD", "6000"), 600000n));
check("refuses a third decimal rather than rounding it", () =>
  assert.equal(parseAssetAmount("MUSD", "0.005"), null));
check("refuses prose", () =>
  assert.equal(parseAssetAmount("MUSD", "twelve"), null));
check("formats to a dollar figure", () =>
  assert.equal(formatAssetAmount("MUSD", 1234n), "$12.34"));
check("groups thousands", () =>
  assert.equal(formatAssetAmount("MUSD", 123456n), "$1,234.56"));

console.log("\nBTC — wei, shown to eight places");
check("parses eight decimals", () =>
  assert.equal(parseAssetAmount("BTC", "0.005"), 5000000000000000n));
check("parses the smallest unit", () =>
  assert.equal(parseAssetAmount("BTC", "0.00000001"), 10000000000n));
check("parses a whole bitcoin", () =>
  assert.equal(parseAssetAmount("BTC", "1"), 1000000000000000000n));
check("refuses a ninth decimal rather than truncating", () =>
  assert.equal(parseAssetAmount("BTC", "0.000000001"), null));
check("formats with its own symbol", () =>
  assert.equal(formatAssetAmount("BTC", 5000000000000000n), "0.005 BTC"));
check("formats a whole bitcoin", () =>
  assert.equal(formatAssetAmount("BTC", 1000000000000000000n), "1 BTC"));

console.log("\nThe two do not mix");
/*
  The failure this module exists to prevent, written down as an assertion. Both
  of these are what a call site that picked the parser by habit rather than by
  asset would produce, and neither of them would show up as an error anywhere.
*/
check("a MUSD amount read as BTC is 10¹⁶ too large", () => {
  const asMusd = parseAssetAmount("MUSD", "12.34");
  const asBtc = parseAssetAmount("BTC", "12.34");
  assert.equal(asMusd, 1234n);
  assert.equal(asBtc, 12340000000000000000n);
  assert.equal(asBtc! / asMusd!, 10n ** 16n);
});
check("a BTC amount read as MUSD comes back null, not a wrong number", () =>
  // Three decimals, and the MUSD parser accepts two. `null` is the honest
  // answer; a truncating parser would have said 0, and a caller that folded
  // that into a total would have dropped the row silently.
  assert.equal(parseAssetAmount("MUSD", "0.005"), null));

console.log("\nRound trips — each asset through its own parser");
/*
  MUSD needs its display grouping removed first, and that is not the test being
  lenient: it is the property. `formatAssetAmount` renders for a reader ("$6,000.00")
  and the parser takes what a *user types*, so the two are deliberately not
  inverses for anything above a thousand. The next check pins that on purpose —
  a stored amount is a `Decimal` column, never a formatted string, and this is
  the assertion that says so.
*/
check("MUSD survives a round trip once its display grouping is removed", () => {
  for (const units of [0n, 1n, 1234n, 600000n, 999999999n]) {
    const bare = formatAssetAmount("MUSD", units).slice(1).replace(/,/g, "");
    assert.equal(parseAssetAmount("MUSD", bare), units);
  }
});
check("the grouping commas are display-only, and the parser refuses them", () =>
  assert.equal(parseAssetAmount("MUSD", "1,234.56"), null));
check("BTC survives a format/parse round trip", () => {
  for (const wei of [0n, 10000000000n, 5000000000000000n, 1000000000000000000n]) {
    assert.equal(parseAssetAmount("BTC", formatAssetAmount("BTC", wei).replace(" BTC", "")), wei);
  }
});
/*
  The MUSD formatter rounds down to the cent, so the round trip is only exact
  for whole cents — which is the unit the app holds money in, and the reason
  nothing downstream ever sees the dust.
*/
check("BTC below a satoshi formats to 0 and parses back to 0", () => {
  assert.equal(formatAssetAmount("BTC", 1n), "0 BTC");
  assert.equal(parseAssetAmount("BTC", "0"), 0n);
});

console.log("\nSigns");
check("received MUSD leads with +", () =>
  assert.equal(formatSignedAssetAmount("MUSD", 1234n, "received"), "+$12.34"));
check("sent MUSD leads with a minus", () =>
  assert.equal(formatSignedAssetAmount("MUSD", 1234n, "sent"), "−$12.34"));
check("received BTC leads with + and names its token", () =>
  assert.equal(
    formatSignedAssetAmount("BTC", 5000000000000000n, "received"),
    "+0.005 BTC",
  ));

console.log(`\n${passed} assertions passed\n`);
