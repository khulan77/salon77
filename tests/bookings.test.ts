import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  bookingSchema,
  transitions,
} from "../lib/booking-validation";
import {
  localInstant,
  localStamp,
  dayWindow,
  addDays,
  SLOT_INTERVAL_MINUTES,
} from "../lib/business-time";
import { fits } from "../lib/services/bookings";
test("Mongolian phone formatting is normalized without losing international prefixes", () => {
  for (const value of [
    "99112233",
    "99 11-22-33",
    "+976 99112233",
    "97699112233",
    "00976 99112233",
  ])
    assert.equal(normalizePhone(value), "+97699112233");
  assert.equal(normalizePhone("+44 (20) 7946 0958"), "+442079460958");
  for (const value of ["123", "abc", "99112233 ext 4", "++97699112233"])
    assert.throws(() => normalizePhone(value));
});
test("business timezone converts UTC day boundaries and accepts future zone configuration", () => {
  assert.equal(
    localInstant("2026-10-20T10:00").toISOString(),
    "2026-10-20T02:00:00.000Z",
  );
  assert.equal(localStamp("2026-10-19T16:00:00Z"), "2026-10-20T00:00");
  assert.equal(
    dayWindow("2026-10-20").end.toISOString(),
    "2026-10-20T16:00:00.000Z",
  );
  assert.equal(
    localInstant("2026-10-20T10:00", "UTC").toISOString(),
    "2026-10-20T10:00:00.000Z",
  );
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(SLOT_INTERVAL_MINUTES, 15);
});
test("entire appointment must fit a shift and avoid even partial blocked overlap", () => {
  const shifts = [{ start: 600, end: 1080 }],
    blocked = [
      { start: 780, end: 840 },
      { start: 900, end: 990 },
    ];
  for (const [start, end] of [
    [540, 630],
    [1020, 1110],
    [720, 810],
    [840, 930],
    [885, 945],
  ])
    assert.equal(fits(start, end, shifts, blocked), false);
  for (const [start, end] of [
    [600, 690],
    [690, 780],
    [990, 1080],
  ])
    assert.equal(fits(start, end, shifts, blocked), true);
});
test("booking request rejects client-derived snapshots, source and tenant injection", () => {
  const base = {
    branchId: "b",
    serviceId: "s",
    startAt: "2026-10-20T02:00:00Z",
    customer: { name: "Ану", phone: "99112233" },
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
  };
  assert.equal(bookingSchema.safeParse(base).success, true);
  for (const data of [
    { price: 1 },
    { duration: 1 },
    { salonId: "victim" },
    { endAt: base.startAt },
    { source: "OWNER" },
    { status: "COMPLETED" },
    { customerId: "existing" },
  ])
    assert.equal(bookingSchema.safeParse({ ...base, ...data }).success, false);
});
test("lifecycle has no terminal-state restoration", () => {
  assert.deepEqual(transitions.PENDING, ["CONFIRMED", "CANCELLED"]);
  assert.deepEqual(transitions.CONFIRMED, [
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]);
  for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW"])
    assert.deepEqual(transitions[status], []);
});
