import assert from "node:assert/strict";
import {
  parseDecimalToUnits,
  unitsToDecimal,
  formatUnits,
  evaluate,
  currentValue,
  isConfirmable,
  pressDigit,
  pressDecimal,
  pressOperator,
  pressBackspace,
  clearKeypad,
  CHAIN_DECIMALS,
  ONE,
  toDisplayUnits,
  toChainUnits,
  btcValueUnits,
  INITIAL_KEYPAD,
  type KeypadState,
  type Op,
  type Token,
} from "./amount.ts";
import { MUSD_DECIMALS } from "../../lib/mezo/config.ts";

const num = (text: string): Token => ({ kind: "num", text });
const op = (value: Op): Token => ({ kind: "op", op: value });

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

console.log("\nparse / format");
check("parses whole numbers", () => assert.equal(parseDecimalToUnits("12"), 1200n));
check("parses decimals", () => assert.equal(parseDecimalToUnits("12.34"), 1234n));
check("parses one decimal", () => assert.equal(parseDecimalToUnits("12.5"), 1250n));
check("rejects too many decimals", () => assert.equal(parseDecimalToUnits("12.345"), null));
check("rejects empty", () => assert.equal(parseDecimalToUnits(""), null));
check("rejects bare dot", () => assert.equal(parseDecimalToUnits("."), null));
check("rejects negatives", () => assert.equal(parseDecimalToUnits("-5"), null));
check("rejects junk", () => assert.equal(parseDecimalToUnits("5x"), null));
check("renders decimal", () => assert.equal(unitsToDecimal(1234n), "12.34"));
check("renders sub-unit", () => assert.equal(unitsToDecimal(5n), "0.05"));
check("renders thousands", () => assert.equal(formatUnits(123456n), "1,234.56"));

console.log("\nchain bridge (18-decimal mUSD <-> 2-decimal minor units)");
check("the local chain-decimal count matches the config", () =>
  assert.equal(CHAIN_DECIMALS, MUSD_DECIMALS));
check("153.00 mUSD is 153e18 on-chain", () =>
  assert.equal(toChainUnits(15300n), 15300n * 10n ** 16n));
check("a whole mUSD round-trips", () =>
  assert.equal(toDisplayUnits(toChainUnits(ONE)), ONE));
check("zero round-trips", () => {
  assert.equal(toChainUnits(0n), 0n);
  assert.equal(toDisplayUnits(0n), 0n);
});
check("sub-cent dust truncates down, never up", () =>
  assert.equal(toDisplayUnits(15300999999999999999n), 1530n));
check("a balance below one cent reads as zero", () =>
  assert.equal(toDisplayUnits(10n ** 16n - 1n), 0n));
check("the bridge agrees with the keypad's own parser", () =>
  assert.equal(
    toChainUnits(parseDecimalToUnits("12.34") as bigint),
    12_340_000_000_000_000_000n,
  ));

console.log("\nBTC valuation (wei × micro-dollar price -> minor units)");
// 0.001001 BTC at $68,432.15 is $68.5005…, which truncates to $68.50 — the
// figure the Home card prints under the amount, and the addend that keeps the
// total from omitting BTC.
check("prices a small BTC balance into cents", () =>
  assert.equal(btcValueUnits(1_001_000_000_000_000n, 68_432_150_000n), 6850n));
check("one whole BTC at $50,000 is 5,000,000 cents", () =>
  assert.equal(btcValueUnits(10n ** 18n, 50_000_000_000n), 5_000_000n));
check("satoshi-scale BTC truncates to nothing, not to a cent", () =>
  assert.equal(btcValueUnits(10n ** 10n, 68_432_150_000n), 0n));
check("no BTC is worth nothing at any price", () =>
  assert.equal(btcValueUnits(0n, 68_432_150_000n), 0n));
check("a zero price values nothing rather than failing", () =>
  assert.equal(btcValueUnits(10n ** 18n, 0n), 0n));
// Sub-cent price precision is kept, not dropped at the wire: $68,432.155 is a
// different total from $68,432.15 once a whole BTC is behind it.
check("price keeps its sub-cent precision", () =>
  assert.equal(btcValueUnits(10n ** 18n, 68_432_155_000n), 6_843_215n));

console.log("\nevaluation (exact, no floats)");
check("adds", () => assert.equal(evaluate([num("1"), op("+"), num("2")]), 300n));
check("0.1 + 0.2 is exactly 0.30", () =>
  assert.equal(evaluate([num("0.1"), op("+"), num("0.2")]), 30n));
check("× binds tighter than +", () =>
  assert.equal(evaluate([num("1"), op("+"), num("2"), op("×"), num("3")]), 700n));
check("× binds tighter, reversed", () =>
  assert.equal(evaluate([num("2"), op("×"), num("3"), op("+"), num("1")]), 700n));
check("left-to-right subtraction", () =>
  assert.equal(evaluate([num("10"), op("-"), num("3"), op("-"), num("2")]), 500n));
check("division", () => assert.equal(evaluate([num("10"), op("÷"), num("4")]), 250n));
check("division by zero is null", () =>
  assert.equal(evaluate([num("5"), op("÷"), num("0")]), null));
check("trailing operator is null", () =>
  assert.equal(evaluate([num("5"), op("+")]), null));
check("leading operator is null", () => assert.equal(evaluate([op("+"), num("5")]), null));
check("empty is null", () => assert.equal(evaluate([]), null));

console.log("\nkeypad state machine");
const type = (keys: string, from: KeypadState = INITIAL_KEYPAD): KeypadState =>
  keys.split("").reduce((s, k) => {
    if (k >= "0" && k <= "9") return pressDigit(s, k);
    if (k === ".") return pressDecimal(s);
    return pressOperator(s, k as Op);
  }, from);

check("typing digits", () => assert.equal(type("12").current, "12"));
check("leading zero is replaced", () => assert.equal(type("05").current, "5"));
check("bare zero survives", () => assert.equal(type("0").current, "0"));
check("second decimal point is ignored", () => {
  const s = type("1.5");
  assert.equal(pressDecimal(s).current, "1.5");
});
check("digits keep flowing after an ignored decimal point", () => {
  // 1 . 5 . (ignored) 5  ->  1.55
  assert.equal(type("1.5.5").current, "1.55");
});
check("digit after operator does not corrupt expression", () => {
  // The original prototype's bug: "12+" then "3" appended to the expression.
  const s = type("12+3");
  assert.deepEqual(s.pending, [num("12"), op("+")]);
  assert.equal(s.current, "3");
  assert.equal(currentValue(s), 1500n);
});
check("operator replaces trailing operator", () => {
  const s = type("12+×");
  assert.deepEqual(s.pending, [num("12"), op("×")]);
});
check("operator with nothing typed is ignored", () => {
  assert.deepEqual(pressOperator(INITIAL_KEYPAD, "+"), INITIAL_KEYPAD);
});
check("running total updates live", () => {
  assert.equal(currentValue(type("10")), 1000n);
  assert.equal(currentValue(type("10+")), 1000n);
  assert.equal(currentValue(type("10+5")), 1500n);
});
check("backspace deletes a digit", () =>
  assert.equal(pressBackspace(type("123")).current, "12"));
check("backspace over operator reopens the number", () => {
  const s = pressBackspace(type("12+"));
  assert.equal(s.current, "12");
  assert.deepEqual(s.pending, []);
});
check("clear resets everything", () => {
  const s = clearKeypad();
  assert.deepEqual(s, INITIAL_KEYPAD);
});

console.log("\nconfirmability");
check("zero is not confirmable", () => assert.equal(isConfirmable(type("0")), false));
check("blank is not confirmable", () => assert.equal(isConfirmable(INITIAL_KEYPAD), false));
check("trailing operator is not confirmable", () =>
  assert.equal(isConfirmable(type("12+")), false));
check("positive amount is confirmable", () =>
  assert.equal(isConfirmable(type("12.5")), true));
check("computed amount is confirmable", () =>
  assert.equal(isConfirmable(type("2×3")), true));

console.log(`\n${passed} assertions passed\n`);
