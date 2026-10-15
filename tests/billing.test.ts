import test from "node:test";
import assert from "node:assert/strict";
import {
  billingState,
  monthlyAmount,
  nextPeriod,
  trialEnd,
} from "../lib/billing";
const DAY = 86400000;
const now = new Date("2026-11-01T04:00:00Z");
const days = (n: number) => new Date(+now + n * DAY);
const salon = (
  trial: number | null,
  paid: number | null,
  status = "APPROVED",
) => ({
  reviewStatus: status,
  trialEndsAt: trial === null ? null : days(trial),
  paidUntil: paid === null ? null : days(paid),
});
test("billing state follows the trial, then paid periods", () => {
  assert.equal(
    billingState(salon(null, null, "PENDING"), now).state,
    "PENDING",
  );
  assert.equal(billingState(salon(null, null), now).state, "FREE");
  const trial = billingState(salon(10, null), now);
  assert.equal(trial.state, "TRIAL");
  assert.equal(trial.daysLeft, 10);
  assert.equal(trial.warn, false);
  assert.equal(billingState(salon(3, null), now).warn, true);
  assert.equal(billingState(salon(4, null), now).warn, false);
  assert.equal(billingState(salon(-1, null), now).state, "EXPIRED");
  assert.equal(billingState(salon(0, null), now).state, "EXPIRED");
  assert.equal(billingState(salon(-20, 12), now).state, "PAID");
  assert.equal(billingState(salon(-20, -1), now).state, "EXPIRED");
  // A payment during the trial keeps the trial days.
  assert.deepEqual(billingState(salon(5, 35), now).until, days(35));
});
test("a payment extends from the current end, never losing days", () => {
  assert.deepEqual(trialEnd(now), days(14));
  assert.deepEqual(nextPeriod(salon(5, null), now), {
    start: days(5),
    end: days(35),
  });
  assert.deepEqual(nextPeriod(salon(-3, null), now), {
    start: now,
    end: days(30),
  });
  assert.deepEqual(nextPeriod(salon(-40, 2), now).end, days(32));
});
test("the monthly fee is per active branch, at least one", () => {
  assert.equal(monthlyAmount(149000, 2), 298000);
  assert.equal(monthlyAmount(149000, 0), 149000);
});
