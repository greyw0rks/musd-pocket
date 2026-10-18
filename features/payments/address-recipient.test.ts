import assert from "node:assert/strict";
import { addressRecipient } from "./address-recipient.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

/** A real address, and the same one with no checksum to contradict. */
const CHECKSUMMED = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const LOWER = CHECKSUMMED.toLowerCase();

/** `ok: true` or a thrown assertion, so the callers below stay one line. */
const accept = (input: string) => {
  const result = addressRecipient(input);
  assert.equal(result.ok, true, `expected ${input} to be accepted`);
  if (!result.ok) throw new Error("unreachable");
  return result.recipient;
};

const reject = (input: string) => {
  const result = addressRecipient(input);
  assert.equal(result.ok, false, `expected ${JSON.stringify(input)} to be refused`);
  if (result.ok) throw new Error("unreachable");
  return result.error;
};

console.log("\naccepting an address");
check("accepts a checksummed address", () => {
  const recipient = accept(CHECKSUMMED);
  assert.equal(recipient.address, CHECKSUMMED);
  assert.equal(recipient.verified, true);
});
check("accepts an all-lowercase address", () => {
  // Nothing in it contradicts a checksum, so there is nothing to reject.
  assert.equal(accept(LOWER).address, CHECKSUMMED);
});
check("checksums what it stores", () => {
  assert.equal(accept(LOWER).address, CHECKSUMMED);
  assert.notEqual(accept(LOWER).address, LOWER);
});
check("trims surrounding whitespace", () => {
  // A double-tap on paste often carries a trailing space or newline.
  assert.equal(accept(`  ${LOWER}\n`).address, CHECKSUMMED);
});

console.log("\nthe label");
check("shortens in the shape the activity feed uses", () => {
  // 6 head / 4 tail, matching `shorten()` in api-payment.adapter.ts.
  assert.equal(accept(LOWER).name, "0xd8dA…6045");
});
check("shows the same string as name and handle", () => {
  const recipient = accept(LOWER);
  assert.equal(recipient.name, recipient.handle);
});
check("contains no space, so the transfer heading keeps it whole", () => {
  // TransferScreen heads itself "Send to {name.split(' ')[0]}".
  assert.equal(accept(LOWER).name.includes(" "), false);
});

console.log("\nidentity");
check("ids are lowercased so the same address is one recipient", () => {
  assert.equal(accept(CHECKSUMMED).id, accept(LOWER).id);
});
check("ids cannot collide with a saved contact's cuid", () => {
  assert.equal(accept(LOWER).id.startsWith("address:"), true);
});
check("two different addresses are two recipients", () => {
  const other = "0x0000000000000000000000000000000000000001";
  assert.notEqual(accept(LOWER).id, accept(other).id);
});

console.log("\nrefusing a bad address");
check("refuses empty", () => {
  assert.equal(reject("").length > 0, true);
});
check("refuses whitespace only", () => {
  assert.equal(reject("   ").length > 0, true);
});
check("refuses a bare handle", () => {
  assert.equal(reject("@sarah").length > 0, true);
});
check("refuses a missing 0x", () => {
  assert.equal(reject(CHECKSUMMED.slice(2)).length > 0, true);
});
check("refuses the wrong length", () => {
  assert.equal(reject(`${LOWER}ff`).length > 0, true);
  assert.equal(reject(LOWER.slice(0, -1)).length > 0, true);
});
check("refuses non-hex characters", () => {
  // `g` is not a hex digit; the string is otherwise the right length.
  assert.equal(reject(`${LOWER.slice(0, -1)}g`).length > 0, true);
});
check("refuses a checksummed address whose checksum does not add up", () => {
  /*
    One capital flipped. The characters are all valid hex and the length is
    right, so only the EIP-55 checksum inside the casing can catch it — which
    is the entire reason this check is here rather than a regex.
  */
  const broken = `0x${CHECKSUMMED.slice(2, 3).toUpperCase()}${CHECKSUMMED.slice(3)}`;
  assert.notEqual(broken, CHECKSUMMED);
  assert.equal(reject(broken).length > 0, true);
});
check("every refusal is a sentence, not a code", () => {
  for (const bad of ["", "@sarah", "0x123", `${LOWER}ff`]) {
    const error = reject(bad);
    assert.equal(error.endsWith("."), true, `not a sentence: ${error}`);
  }
});

console.log(`\n${passed} assertions passed\n`);
