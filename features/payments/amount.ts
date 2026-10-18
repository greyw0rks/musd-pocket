/**
 * Money arithmetic and keypad input — deliberately its own module.
 *
 * Two things the build plan calls out as must-fix bugs in the original
 * prototype are handled here and nowhere else:
 *
 *  1. **No `Function()`.** Expressions are tokenised and evaluated with an
 *     explicit little parser. Arbitrary JavaScript is never executed.
 *  2. **No floating point.** Every value is an integer count of minor units
 *     (hundredths), so `0.1 + 0.2` is exactly `0.30`, not `0.30000000000000004`.
 *
 * Everything is pure and synchronous, which makes it cheap to unit test.
 */

/** Decimal places shown and entered for MUSD amounts. */
export const DISPLAY_DECIMALS = 2;

/** One whole MUSD, in minor units. */
export const ONE = 10n ** BigInt(DISPLAY_DECIMALS);

/**
 * Decimal places mUSD actually carries on-chain.
 *
 * Duplicated from `MUSD_DECIMALS` in `lib/mezo/config` rather than imported,
 * because this module must stay free of imports to remain testable under plain
 * `node --experimental-strip-types` (see `amount.test.ts`). The two are held
 * together by a test that reads the config value and fails if they disagree —
 * a duplicated constant with a guard, rather than a silent one.
 */
export const CHAIN_DECIMALS = 18;

/** Multiply by this to go from minor units up to chain units. */
export const UNIT_SHIFT = 10n ** BigInt(CHAIN_DECIMALS - DISPLAY_DECIMALS);

/**
 * Chain units (18 decimals) → the UI's minor units, truncated.
 *
 * Integer division, not a string round-trip: `formatMusd` would give the full
 * 18-decimal string and `parseDecimalToUnits` rejects anything past two
 * decimals, so the obvious bridge returns `null` for any balance carrying dust.
 * Truncating also means a balance is never overstated by rounding up.
 */
export function toDisplayUnits(raw: bigint): bigint {
  return raw / UNIT_SHIFT;
}

/**
 * The UI's minor units → chain units (18 decimals), exact.
 *
 * The inverse of `toDisplayUnits`, and lossless in this direction: every
 * amount the keypad can produce is a whole number of hundredths, so scaling it
 * up loses nothing. This is the one place an amount the user typed becomes an
 * amount the token contract is asked to move.
 */
export function toChainUnits(units: bigint): bigint {
  return units * UNIT_SHIFT;
}

/* -------------------------------------------------------------------------- */
/* BTC valuation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The scale a USD price arrives on: a millionth of a dollar, as an integer.
 *
 * A price is money, so it gets the same treatment as money — no float. Six
 * decimals is what a spot price is quoted to, and it is enough that a whole
 * BTC's worth of rounding lands well inside the last cent the card prints.
 */
export const PRICE_SCALE = 1_000_000n;

/**
 * `wei × price` carries 18 + 6 decimals; reducing that to hundredths drops 22.
 *
 * 18 (wei) + 6 (price) − 2 (minor units) = 22.
 */
const PRICE_SHIFT = 10n ** 22n;

/**
 * What a BTC amount is worth, in the UI's minor units, at a given price.
 *
 * `wei` is a native BTC balance in chain units — the gas token, 18 decimals —
 * and `usdMicros` a price on `PRICE_SCALE`. The answer is in the same
 * hundredths every other figure in this module speaks, so it can be summed
 * with an mUSD balance and handed to `formatUnits` while staying exact:
 *
 *     wei × usdMicros / 1e22   ≈   (wei / 1e18) × (usdMicros / 1e6) × 100
 *
 * Truncating, like `toDisplayUnits` and for the same reason: a total is never
 * overstated by the arithmetic that produced it. The other direction would be
 * a balance that reads higher than the money behind it.
 *
 * mUSD is a dollar stablecoin, so a USD price is already a price in MUSD — the
 * peg is assumed here rather than looked up, and if that assumption is ever
 * wrong this is the line that decides by how much.
 */
export function btcValueUnits(wei: bigint, usdMicros: bigint): bigint {
  return (wei * usdMicros) / PRICE_SHIFT;
}

export type Op = "+" | "-" | "×" | "÷";

export type Token =
  | { kind: "num"; text: string }
  | { kind: "op"; op: Op };

export const OPS: readonly Op[] = ["+", "-", "×", "÷"];

export function isOp(value: string): value is Op {
  return (OPS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Decimal <-> minor units                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Parse a plain decimal string ("12", "12.5", "12.50") into minor units.
 * Returns `null` for anything that is not a well-formed amount, including
 * empty strings, a bare ".", negatives, and more decimals than we display.
 */
export function parseDecimalToUnits(text: string): bigint | null {
  if (!/^\d*\.?\d*$/.test(text)) return null;
  if (text === "" || text === ".") return null;

  const [whole, frac = ""] = text.split(".");
  if (frac.length > DISPLAY_DECIMALS) return null;

  const padded = frac.padEnd(DISPLAY_DECIMALS, "0");
  return BigInt(whole === "" ? "0" : whole) * ONE + BigInt(padded);
}

/** Render minor units as a plain decimal string, e.g. 1234n -> "12.34". */
export function unitsToDecimal(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / ONE;
  const frac = (abs % ONE).toString().padStart(DISPLAY_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Render minor units with thousands separators, e.g. 123456n -> "1,234.56". */
export function formatUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = (abs / ONE).toLocaleString("en-US");
  const frac = (abs % ONE).toString().padStart(DISPLAY_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/* -------------------------------------------------------------------------- */
/* Exact evaluation                                                            */
/* -------------------------------------------------------------------------- */

/** Multiply two scaled values, truncating the extra precision. */
function mulScaled(a: bigint, b: bigint): bigint {
  return (a * b) / ONE;
}

/** Divide two scaled values, truncating. Caller must reject `b === 0n`. */
function divScaled(a: bigint, b: bigint): bigint {
  return (a * ONE) / b;
}

type Node = { value: bigint } | { op: Op };

/**
 * Evaluate a token list with exact integer arithmetic.
 *
 * `×` and `÷` bind tighter than `+` and `-`; operators of equal precedence
 * associate left to right. Returns `null` when the expression is incomplete
 * (trailing operator, empty), malformed, or divides by zero.
 */
export function evaluate(tokens: readonly Token[]): bigint | null {
  if (tokens.length === 0) return null;

  // Flatten into strict value / operator alternation first, so both passes
  // below can assume well-formed input.
  const nodes: Node[] = [];
  let expectValue = true;
  for (const token of tokens) {
    if (token.kind === "num") {
      if (!expectValue) return null;
      const units = parseDecimalToUnits(token.text);
      if (units === null) return null;
      nodes.push({ value: units });
      expectValue = false;
    } else {
      if (expectValue) return null;
      nodes.push({ op: token.op });
      expectValue = true;
    }
  }
  if (expectValue) return null; // ends on an operator

  // Pass 1 — fold × and ÷, which bind tighter.
  const stage1: Node[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if ("op" in node && (node.op === "×" || node.op === "÷")) {
      const left = stage1[stage1.length - 1];
      const right = nodes[i + 1];
      if (!left || !("value" in left)) return null;
      if (!right || !("value" in right)) return null;

      if (node.op === "÷") {
        if (right.value === 0n) return null;
        stage1[stage1.length - 1] = { value: divScaled(left.value, right.value) };
      } else {
        stage1[stage1.length - 1] = { value: mulScaled(left.value, right.value) };
      }
      i++; // consume the right operand
    } else {
      stage1.push(node);
    }
  }

  // Pass 2 — left-to-right sum of the remaining values and +/- operators.
  let total: bigint | null = null;
  let sign: 1n | -1n = 1n;
  for (const node of stage1) {
    if ("op" in node) {
      sign = node.op === "-" ? -1n : 1n;
      continue;
    }
    total = total === null ? node.value : total + sign * node.value;
    sign = 1n;
  }

  return total;
}

/* -------------------------------------------------------------------------- */
/* Keypad input model                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Keypad state.
 *
 * `pending` holds settled tokens (numbers and operators). `current` is the
 * digits being typed right now. Keeping the in-progress number separate from
 * the operator list is the fix for the original prototype's bug, where a
 * digit typed after an operator was appended to the expression string and
 * could corrupt it.
 */
export interface KeypadState {
  pending: Token[];
  current: string;
}

export const INITIAL_KEYPAD: KeypadState = { pending: [], current: "" };

/** Digits allowed in a whole part. */
export const MAX_ENTRY_DIGITS = 9;

/** The token list including the in-progress number, if any. */
export function tokensOf(state: KeypadState): Token[] {
  return state.current
    ? [...state.pending, { kind: "num", text: state.current }]
    : state.pending;
}

/** True when the last settled token is a number (i.e. not mid-operator). */
function endsOnValue(state: KeypadState): boolean {
  const tokens = tokensOf(state);
  const last = tokens[tokens.length - 1];
  return Boolean(last && last.kind === "num");
}

/**
 * The running total, or `null` when the expression is incomplete or invalid.
 * A trailing operator previews the total of everything before it.
 */
export function currentValue(state: KeypadState): bigint | null {
  const tokens = tokensOf(state);
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  return last.kind === "op" ? evaluate(tokens.slice(0, -1)) : evaluate(tokens);
}

/** A positive, well-formed amount is on screen — i.e. safe to confirm. */
export function isConfirmable(state: KeypadState): boolean {
  if (!endsOnValue(state)) return false;
  const value = currentValue(state);
  return value !== null && value > 0n;
}

export function pressDigit(state: KeypadState, digit: string): KeypadState {
  if (!/^\d$/.test(digit)) return state;

  // A lone leading zero is replaced rather than appended to ("0" -> "7").
  const base = state.current === "0" ? "" : state.current;
  const next = base + digit;

  const [whole = "", frac = ""] = next.split(".");
  if (whole.length > MAX_ENTRY_DIGITS) return state;
  if (frac.length > DISPLAY_DECIMALS) return state;

  return { ...state, current: next };
}

export function pressDecimal(state: KeypadState): KeypadState {
  if (state.current.includes(".")) return state;
  return {
    ...state,
    current: state.current === "" ? "0." : `${state.current}.`,
  };
}

export function pressOperator(state: KeypadState, op: Op): KeypadState {
  // No number in progress: either replace a trailing operator, or do nothing
  // if there is nothing to operate on yet.
  if (!state.current) {
    const last = state.pending[state.pending.length - 1];
    if (last && last.kind === "op") {
      return {
        ...state,
        pending: [...state.pending.slice(0, -1), { kind: "op", op }],
      };
    }
    if (state.pending.length === 0) return state;
    return { ...state, pending: [...state.pending, { kind: "op", op }] };
  }

  return {
    pending: [
      ...state.pending,
      { kind: "num", text: state.current },
      { kind: "op", op },
    ],
    current: "",
  };
}

export function pressBackspace(state: KeypadState): KeypadState {
  if (state.current) {
    return { ...state, current: state.current.slice(0, -1) };
  }
  if (state.pending.length === 0) return state;

  const pending = state.pending.slice(0, -1);
  const last = pending[pending.length - 1];
  // Stepping back over an operator reopens the number before it.
  if (last && last.kind === "num") {
    return { pending: pending.slice(0, -1), current: last.text };
  }
  return { ...state, pending };
}

export function clearKeypad(): KeypadState {
  return INITIAL_KEYPAD;
}

/** Human-readable expression for display, e.g. "12 + 3". */
export function expressionText(state: KeypadState): string {
  const parts = state.pending.map((token) =>
    token.kind === "num" ? token.text : token.op,
  );
  if (state.current) parts.push(state.current);
  return parts.join(" ");
}
