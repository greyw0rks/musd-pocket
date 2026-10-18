import assert from "node:assert/strict";
import {
  BTC_DECIMALS,
  formatBtc,
  formatMusd,
  formatUsd,
  formatLiquidationPrice,
  formatRatio,
  formatThreshold,
  parseBtc,
} from "./borrow-format.ts";

const E18 = 10n ** 18n;

/** A decimal string → 18-decimal wei, for writing expectations readably. */
function wei(text: string): bigint {
  const [whole, frac = ""] = text.split(".");
  return BigInt(whole) * E18 + BigInt(frac.padEnd(18, "0").slice(0, 18) || "0");
}

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

console.log("\nBTC collateral (8 places, truncated, trailing zeros trimmed)");
check("1 BTC renders without a tail", () => assert.equal(formatBtc(E18), "1"));
check("a small collateral keeps satoshi resolution", () =>
  assert.equal(formatBtc(wei("0.00021")), "0.00021"));
check("zero collateral is a plain zero", () => assert.equal(formatBtc(0n), "0"));
check("sub-satoshi dust truncates to zero", () =>
  assert.equal(formatBtc(5_000_000_000n), "0"));
check("truncates rather than rounds up", () =>
  // One wei below 0.00022 BTC. Eight places hold 0.00021999; the ninth digit is
  // dropped rather than carried, so a collateral figure never overstates itself.
  assert.equal(formatBtc(wei("0.00022") - 1n), "0.00021999"));

/*
  The parser is the other half of a money path: what it accepts is what gets
  signed, so the cases that matter are the ones it must *refuse*. Everything
  below is either an exact reading of a typed amount or a deliberate null.
*/
console.log("\ntyped BTC amounts (the inverse of formatBtc)");
check("a satoshi-scale amount lands on the right wei", () =>
  assert.equal(parseBtc("0.001"), 10n ** 15n));
check("a whole number is 1e18", () => assert.equal(parseBtc("1"), E18));
check("eight places is the last accepted digit", () =>
  assert.equal(parseBtc("0.00000001"), 10n ** 10n));
check("zero parses as zero, and is not null", () =>
  assert.equal(parseBtc("0"), 0n));
check("a leading dot is a real amount", () =>
  assert.equal(parseBtc(".5"), 5n * 10n ** 17n));
check("a trailing dot is a real amount", () =>
  assert.equal(parseBtc("1."), E18));
check("leading zeros do not change the value", () =>
  assert.equal(parseBtc("007"), 7n * E18));

console.log("\nwhat the parser must refuse");
check("an empty field is not a request to send nothing", () =>
  assert.equal(parseBtc(""), null));
check("a bare dot is unfinished, not zero", () => assert.equal(parseBtc("."), null));
check("letters are refused", () => assert.equal(parseBtc("0.1a"), null));
check("a second dot is refused", () => assert.equal(parseBtc("1.2.3"), null));
check("a negative is refused", () => assert.equal(parseBtc("-1"), null));
check("a grouped figure is refused rather than read as 1", () =>
  assert.equal(parseBtc("1,000"), null));
check("a ninth decimal is refused, never truncated", () =>
  // Silently dropping this digit would sign a transfer for less than the user
  // typed. A visible refusal is the honest answer.
  assert.equal(parseBtc("0.000000001"), null));
check("whitespace is not trimmed away for the user", () =>
  assert.equal(parseBtc(" 0.1"), null));

/*
  The property that a Max control depends on: what `formatBtc` prints can be
  typed back in, and it never reads as more than the figure it printed.
*/
console.log("\nformatBtc and parseBtc agree");
check("a formatted amount round-trips unchanged", () =>
  assert.equal(parseBtc(formatBtc(wei("0.00021"))), wei("0.00021")));
check("what is printed is never more than what was measured", () => {
  // One wei past the eighth place. The printed figure loses that wei; the
  // parsed figure must therefore come back *below* the original, since a Max
  // control fills the field from it and a ceiling that rounds up is a transfer
  // the chain refuses.
  const exact = wei("0.00021") + 1n;
  const printed = formatBtc(exact);
  assert.ok(!printed.includes("e"), `expected no exponent, got ${printed}`);
  const back = parseBtc(printed);
  assert.notEqual(back, null);
  assert.ok(back! <= exact, `${printed} parsed above the value it printed`);
});
check("a decimal count is what the parser enforces", () =>
  assert.equal(BTC_DECIMALS, 8));

console.log("\nMUSD amounts (2 places, truncated)");
check("the 200 MUSD gas reserve", () => assert.equal(formatMusd(200n * E18), "200.00"));
check("a fractional debt", () => assert.equal(formatMusd(wei("1800.5")), "1800.50"));
check("truncates a third decimal", () =>
  assert.equal(formatMusd(wei("1800.999")), "1800.99"));
check("zero", () => assert.equal(formatMusd(0n), "0.00"));

console.log("\nUSD price (18-decimal oracle)");
check("the live testnet oracle value", () =>
  assert.equal(formatUsd(wei("81318.90712")), "$81,318.90"));
check("separates thousands", () => assert.equal(formatUsd(wei("1234.5")), "$1,234.50"));
check("under a thousand has no separator", () =>
  assert.equal(formatUsd(wei("999.99")), "$999.99"));
check("a null price is an em dash, never $0.00", () =>
  assert.equal(formatUsd(null), "—"));

console.log("\nliquidation price rounds the other way, on purpose");
check("a truncated threshold would understate the danger", () =>
  // The same value both ways: the rounded-up figure is the honest warning.
  assert.notEqual(
    formatLiquidationPrice(wei("68412.001")),
    formatUsd(wei("68412.001")),
  ));
check("rounds up to the next cent", () =>
  assert.equal(formatLiquidationPrice(wei("68412.001")), "$68,412.01"));
check("an exact value is left alone", () =>
  assert.equal(formatLiquidationPrice(wei("68412.00")), "$68,412.00"));
check("a null threshold is an em dash", () =>
  assert.equal(formatLiquidationPrice(null), "—"));

console.log("\ncollateral ratio (1e18 = 100%, so 2.714e18 is 271.4%)");
check("a healthy position", () => assert.equal(formatRatio(wei("2.714")), "271.4%"));
check("exactly at the critical ratio", () =>
  assert.equal(formatRatio(wei("1.5")), "150.0%"));
check("exactly at the minimum ratio", () =>
  assert.equal(formatRatio(wei("1.1")), "110.0%"));
check("truncates toward the danger, never to a rounder number", () =>
  // 149.96% is below the 150% critical ratio; rendering it "150.0%" would show
  // a position clearing a threshold it does not clear.
  assert.equal(formatRatio(wei("1.4996")), "149.9%"));
check("a null ratio (no debt) is an em dash", () =>
  assert.equal(formatRatio(null), "—"));

console.log("\nprotocol thresholds");
check("minimum collateral ratio", () => assert.equal(formatThreshold(110n * 10n ** 16n), "110%"));
check("critical collateral ratio", () => assert.equal(formatThreshold(150n * 10n ** 16n), "150%"));

console.log("\nno figure ever reaches exponent notation");
check("a huge ratio stays a plain string", () => {
  // A near-zero debt makes the ratio enormous; `toString` on a bigint is always
  // plain, and the guard is here so a future `Number()` cast cannot sneak in.
  const text = formatRatio(wei("1000000000000000000"));
  assert.ok(!text.includes("e"), `expected no exponent, got ${text}`);
});

console.log(`\n${passed} passed\n`);
