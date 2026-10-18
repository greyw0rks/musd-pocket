/*
  The repayment ceiling and the opening floor — the two pieces of borrow
  arithmetic that decide whether a form lets a user through or stops them.

  Run:
    npm run test:borrow-rules

  Both rules are read off the deployed `BorrowerOperations` (and confirmed
  present in its bytecode), then encoded as
  arithmetic. This file is the part of that which can be checked without a
  chain: the boundary, either side of it, and the zero case.

  Pure: no network, no wallet, no clock. `maxRepayable` is imported from the
  real module rather than copied, so a change to the write path that is not made
  here fails the test instead of shipping.
*/

import assert from "node:assert/strict";
import { maxRepayable, parseDecimalToWei, weiToDecimalInput } from "./borrow-math.ts";

const E18 = 10n ** 18n;
const musd = (n: number | string) => BigInt(Math.round(Number(n) * 1e6)) * 10n ** 12n;

/** The protocol's live terms at the time of writing, as the tests' fixtures. */
const MIN_NET_DEBT = musd(1800);
const GAS_COMP = musd(200);

let passed = 0;
function check(what: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${what}`);
}

console.log("\nmaxRepayable — a repayment can never take net debt below the minimum");

check("a 5,000 MUSD position can repay 3,000", () => {
  // debt 5000 = net 4800 + 200 reserve; 4800 - 1800 = 3000
  assert.equal(maxRepayable(musd(5000), MIN_NET_DEBT), musd(3000));
});

check("a 5,000 MUSD position cannot repay 3,001", () => {
  assert.ok(maxRepayable(musd(5000), MIN_NET_DEBT) < musd(3001));
});

check("the ceiling lands exactly on the minimum, not below it", () => {
  const debt = musd(5000);
  const max = maxRepayable(debt, MIN_NET_DEBT);
  // What is left after repaying the maximum is exactly the floor.
  assert.equal(debt - GAS_COMP - max, MIN_NET_DEBT);
});

check("a position exactly at the minimum can repay nothing", () => {
  // debt 2000 = net 1800 = the floor.
  assert.equal(maxRepayable(musd(2000), MIN_NET_DEBT), 0n);
});

check("a position below the minimum can repay nothing (not a negative)", () => {
  // Never reached in practice, but a negative ceiling would be a form that
  // accepts a repayment the chain rejects.
  assert.equal(maxRepayable(musd(1900), MIN_NET_DEBT), 0n);
});

check("a position of exactly the reserve can repay nothing", () => {
  assert.equal(maxRepayable(GAS_COMP, MIN_NET_DEBT), 0n);
});

check("no position at all can repay nothing", () => {
  assert.equal(maxRepayable(0n, MIN_NET_DEBT), 0n);
});

check("a dusty position one wei above the floor can repay one wei", () => {
  const debt = musd(2000) + 1n;
  assert.equal(maxRepayable(debt, MIN_NET_DEBT), 1n);
});

console.log("\nthe opening floor — the fee is added before the minimum is checked");

/*
  From the source: `vars.netDebt = _debtAmount`, then `vars.netDebt += vars.fee`,
  and only then `_requireAtLeastMinNetDebt(vars.netDebt)`. So the amount the form
  must accept is not `minNetDebt` — it is the draw for which draw + fee clears
  it. At the live 0.1% rate that makes a draw of 1,798.3 too small and 1,798.4
  large enough, which is exactly the boundary a naive `draw >= minNetDebt` check
  would get wrong in the user's favour.
*/
const RATE = 10n ** 15n; // 0.1%, 1e18-scaled — read live from the deployed contract
const feeOf = (draw: bigint) => (draw * RATE) / E18;

check("a draw of minNetDebt clears the floor with room to spare", () => {
  assert.ok(musd(1800) + feeOf(musd(1800)) >= MIN_NET_DEBT);
});

check("a draw below minNetDebt can still clear it, because of the fee", () => {
  // 1,799 + 1.799 = 1,800.799 — the floor is on the sum.
  assert.ok(musd(1799) + feeOf(musd(1799)) >= MIN_NET_DEBT);
});

check("but a draw far enough below does not", () => {
  assert.ok(musd(1790) + feeOf(musd(1790)) < MIN_NET_DEBT);
});

check("the true minimum draw is just under minNetDebt, not at it", () => {
  // draw * 1.001 >= 1800 → draw >= 1798.201798...
  assert.ok(musd(1798) + feeOf(musd(1798)) < MIN_NET_DEBT);
  assert.ok(musd(1799) + feeOf(musd(1799)) >= MIN_NET_DEBT);
});

console.log("\nparsing — the one crossing from a keyboard to 18-decimal wei");

/*
  The app has two parsers and they are not interchangeable.
  `features/payments/amount.ts` produces 2-decimal minor units, which is right
  for the send screen and catastrophically wrong here: 0.01 BTC through that
  path would reach `openTrove` as 1e-16 BTC. These tests pin the 18-decimal one.
*/

check("a whole number is scaled by 1e18, not by 100", () => {
  // The exact bug this file exists for: 1 through the 2-decimal parser is 100.
  assert.equal(parseDecimalToWei("1"), E18);
});

check("one satoshi's worth of decimal places survives", () => {
  assert.equal(parseDecimalToWei("0.00000001"), 10n ** 10n);
});

check("all 18 decimal places survive", () => {
  assert.equal(parseDecimalToWei("0.000000000000000001"), 1n);
});

check("a bare leading dot parses as a fraction", () => {
  assert.equal(parseDecimalToWei(".5"), musd(0.5));
});

check("a trailing dot parses as a whole number", () => {
  // People type "5." and mean five. Rejecting it would forbid a keystroke
  // rather than a value.
  assert.equal(parseDecimalToWei("5."), musd(5));
});

check("nineteen decimal places are refused rather than silently rounded", () => {
  assert.equal(parseDecimalToWei("0.0000000000000000001"), null);
});

check("an empty field is null, never zero", () => {
  // A form that read "" as 0n would submit nothing and call it a request.
  assert.equal(parseDecimalToWei(""), null);
  assert.equal(parseDecimalToWei("   "), null);
});

check("a lone dot is null", () => {
  assert.equal(parseDecimalToWei("."), null);
});

check("letters, signs and separators are refused", () => {
  assert.equal(parseDecimalToWei("1e18"), null);
  assert.equal(parseDecimalToWei("-1"), null);
  assert.equal(parseDecimalToWei("1,000"), null);
  assert.equal(parseDecimalToWei("0x10"), null);
  assert.equal(parseDecimalToWei("1.2.3"), null);
});

check("round-trip: parse then render is the value you typed", () => {
  for (const text of ["1", "0.5", "0.00000001", "1234.567890123456789"]) {
    assert.equal(weiToDecimalInput(parseDecimalToWei(text)!), text);
  }
});

check("render trims trailing zeros rather than padding to 18", () => {
  assert.equal(weiToDecimalInput(musd(1)), "1");
  assert.equal(weiToDecimalInput(musd(1.5)), "1.5");
});

check("render never rounds a value down to a round number", () => {
  // A "Max" button filled from a rounded figure would leave dust behind that
  // the user asked to move.
  assert.equal(weiToDecimalInput(10n ** 18n + 1n), "1.000000000000000001");
});

console.log(`\n${passed} passed\n`);
