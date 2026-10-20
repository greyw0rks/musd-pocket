import assert from "node:assert/strict";
import {
  TOUR_IDLE,
  TOUR_STEPS,
  beginTour,
  endTour,
  moveTour,
  shouldAutoStart,
  type TourState,
} from "./tour.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

const TOTAL = TOUR_STEPS.length;

console.log("\nthe steps");
check("there is a tour", () => assert.ok(TOTAL >= 3));
check("every step names a target", () =>
  TOUR_STEPS.forEach((step) => assert.ok(step.target.length > 0)),
);
check("no two steps point at the same element", () => {
  const targets = TOUR_STEPS.map((step) => step.target);
  assert.equal(new Set(targets).size, targets.length);
});
check("every step has a title and an explanation", () =>
  TOUR_STEPS.forEach((step) => {
    assert.ok(step.title.trim().length > 0);
    assert.ok(step.body.trim().length > 20);
    assert.notEqual(step.title, step.body);
  }),
);
check("every step says which side to place the card", () =>
  TOUR_STEPS.forEach((step) => assert.ok(step.place === "above" || step.place === "below")),
);
check("the tour opens on the account corner and ends on the passkey", () => {
  // The hook, the faucet, then a top-to-bottom sweep of Home; then the two
  // screens the first pass never showed. If this changes, change the copy with
  // it — the last button says "Start using Pocket" and must land on the end.
  assert.equal(TOUR_STEPS[0].target, "account");
  assert.equal(TOUR_STEPS[TOTAL - 1].target, "passkey");
});
check("the faucet is the step right after the account corner", () => {
  // Both live in the header: the faucet is what you claim before anything on
  // the screen means much, so it is explained there rather than at the end.
  assert.equal(TOUR_STEPS[1].target, "faucet");
});
check("every step names the screen its target lives on", () =>
  TOUR_STEPS.forEach((step) =>
    assert.ok(["home", "profile", "settings"].includes(step.screen)),
  ),
);
check("the tour leaves each screen once and never comes back", () => {
  // The overlay navigates between screens, so a return to an earlier screen
  // would mean a step bouncing backwards through the app mid-tour. The order
  // is Home, then Profile, then Settings.
  const order = ["home", "profile", "settings"];
  let furthest = 0;
  TOUR_STEPS.forEach((step) => {
    const at = order.indexOf(step.screen);
    assert.ok(at >= furthest, `${step.target} returns to ${step.screen}`);
    furthest = at;
  });
});
check("the receipts step is on Profile and the passkey step on Settings", () => {
  const receipts = TOUR_STEPS.find((step) => step.target === "receipts");
  const passkey = TOUR_STEPS.find((step) => step.target === "passkey");
  assert.ok(receipts);
  assert.ok(passkey);
  assert.equal(receipts.screen, "profile");
  assert.equal(passkey.screen, "settings");
});

console.log("\nmoving");
const ready: TourState = { ...TOUR_IDLE, ready: true };

check("begin opens at the first step", () => {
  const next = beginTour(ready);
  assert.equal(next.open, true);
  assert.equal(next.step, 0);
});
check("begin replays from the top even after it was seen", () => {
  const next = beginTour({ ...ready, seen: true, step: 3 });
  assert.equal(next.open, true);
  assert.equal(next.step, 0);
  // Replaying must not un-see it: the auto-start stays off afterwards.
  assert.equal(next.seen, true);
});
check("forward advances one step", () => {
  const next = moveTour(beginTour(ready), TOTAL, 1);
  assert.equal(next.open, true);
  assert.equal(next.step, 1);
});
check("forward past the last step closes", () => {
  const last = { ...ready, open: true, step: TOTAL - 1 };
  const next = moveTour(last, TOTAL, 1);
  assert.equal(next.open, false);
});
check("closing by finishing marks it seen", () => {
  const last = { ...ready, open: true, step: TOTAL - 1 };
  assert.equal(moveTour(last, TOTAL, 1).seen, true);
});
check("the closed step is clamped inside the list", () => {
  const last = { ...ready, open: true, step: TOTAL - 1 };
  const next = moveTour(last, TOTAL, 1);
  assert.ok(next.step >= 0 && next.step < TOTAL);
});
check("back at the first step does nothing", () => {
  const first = { ...ready, open: true, step: 0 };
  assert.deepEqual(moveTour(first, TOTAL, -1), first);
});
check("back mid-tour decrements", () => {
  const middle = { ...ready, open: true, step: 2 };
  assert.equal(moveTour(middle, TOTAL, -1).step, 1);
});
check("moving a closed tour does nothing", () => {
  const closed = { ...ready, open: false, step: 1 };
  assert.deepEqual(moveTour(closed, TOTAL, 1), closed);
});
check("ending closes and marks it seen", () => {
  const next = endTour({ ...ready, open: true, step: 2 });
  assert.equal(next.open, false);
  assert.equal(next.seen, true);
});
check("ending keeps the step for the caller to see", () => {
  assert.equal(endTour({ ...ready, open: true, step: 2 }).step, 2);
});

console.log("\nwhen it runs itself");
check("does not start before storage is read", () => {
  assert.equal(shouldAutoStart(TOUR_IDLE, "home"), false);
});
check("starts on the first visit to home", () => {
  assert.equal(shouldAutoStart(ready, "home"), true);
});
check("does not start away from home", () => {
  assert.equal(shouldAutoStart(ready, "vault"), false);
  assert.equal(shouldAutoStart(ready, "settings"), false);
  assert.equal(shouldAutoStart(ready, "welcome"), false);
});
check("does not start once it has been seen", () => {
  assert.equal(shouldAutoStart({ ...ready, seen: true }, "home"), false);
});
check("does not start while it is already open", () => {
  assert.equal(shouldAutoStart({ ...ready, open: true }, "home"), false);
});
check("finishing a whole tour turns the auto-start off", () => {
  let state: TourState = { ...ready, open: true, step: 0 };
  for (let index = 0; index < TOTAL; index += 1) {
    state = moveTour(state, TOTAL, 1);
  }
  assert.equal(state.seen, true);
  assert.equal(shouldAutoStart(state, "home"), false);
});
check("skipping turns the auto-start off", () => {
  assert.equal(shouldAutoStart(endTour({ ...ready, open: true }), "home"), false);
});

console.log(`\n${passed} checks passed\n`);
