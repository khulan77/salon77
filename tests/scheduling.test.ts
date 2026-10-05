import { test } from "node:test";
import assert from "node:assert/strict";
import { hoursSchema, timeOffSchema, serviceSchema } from "../lib/validation";
import { safeAuthNext } from "../lib/auth-navigation";
import { localToISO, nextDate } from "../lib/schedule-time";
import { actorFromMember, requireBranch } from "../lib/access";
test("authentication continuation only permits an exact invitation URL", () => {
  const path = `/invite?token=${"a".repeat(64)}`;
  assert.equal(safeAuthNext(path), path);
  for (const unsafe of [
    "https://evil.test",
    "//evil.test",
    "/team",
    "/invite?token=abc",
    `${path}&next=https://evil.test`,
  ])
    assert.equal(safeAuthNext(unsafe), "/");
});
test("structured working hours reject inverted ranges, overlap and inactive breaks", () => {
  const data = {
    staffId: "s",
    branchId: "b",
    dayOfWeek: 1,
    startMinute: 600,
    endMinute: 1140,
    active: true,
    breaks: [],
  };
  assert.equal(hoursSchema.safeParse(data).success, true);
  for (const change of [
    { dayOfWeek: 0 },
    { endMinute: 600 },
    { startMinute: -1 },
    { endMinute: 1441 },
    { breaks: [{ startMinute: 500, endMinute: 700 }] },
    {
      breaks: [
        { startMinute: 780, endMinute: 840 },
        { startMinute: 800, endMinute: 850 },
      ],
    },
    { active: false, breaks: [{ startMinute: 780, endMinute: 840 }] },
  ])
    assert.equal(hoursSchema.safeParse({ ...data, ...change }).success, false);
  assert.equal(
    hoursSchema.safeParse({
      ...data,
      breaks: [
        { startMinute: 780, endMinute: 840 },
        { startMinute: 840, endMinute: 900 },
      ],
    }).success,
    true,
  );
});
test("full-day time off converts inclusive local dates into exclusive UTC boundaries", () => {
  const startsAt = localToISO("2026-10-20T00:00"),
    endsAt = localToISO(`${nextDate("2026-10-20")}T00:00`);
  assert.equal(startsAt, "2026-10-19T16:00:00.000Z");
  assert.equal(endsAt, "2026-10-20T16:00:00.000Z");
  const input = {
    staffId: "s",
    branchId: "b",
    startsAt,
    endsAt,
    fullDay: true,
    reason: "",
  };
  assert.equal(timeOffSchema.safeParse(input).success, true);
  assert.equal(
    timeOffSchema.safeParse({ ...input, endsAt: startsAt }).success,
    false,
  );
  assert.equal(
    timeOffSchema.safeParse({ ...input, startsAt: "2026-10-20T00:00:00Z" })
      .success,
    false,
  );
  assert.equal(nextDate("2028-02-28"), "2028-02-29");
});
test("prices and durations remain bounded integers", () => {
  const input = {
    name: "Үйлчилгээ",
    description: "",
    categoryId: "c",
    priceMnt: 65000,
    durationMinutes: 60,
    onlineBookable: true,
    active: true,
    branchIds: ["b"],
  };
  assert.equal(serviceSchema.safeParse(input).success, true);
  for (const change of [
    { priceMnt: -1 },
    { priceMnt: 1.5 },
    { priceMnt: 1000000001 },
    { durationMinutes: 0 },
    { durationMinutes: 1.5 },
    { durationMinutes: 1441 },
  ])
    assert.equal(
      serviceSchema.safeParse({ ...input, ...change }).success,
      false,
    );
});
test("staff role cannot gain access from either branch grant alone", () => {
  const member = {
    id: "m",
    userId: "u",
    salonId: "salon",
    role: "STAFF",
    branches: [{ branchId: "a" }, { branchId: "b" }],
    staff: {
      id: "s",
      active: true,
      branches: [{ branchId: "b" }, { branchId: "c" }],
    },
  };
  const actor = actorFromMember(member);
  assert.deepEqual(actor.branchIds, ["b"]);
  assert.throws(() => requireBranch(actor, "a"));
  assert.throws(() => requireBranch(actor, "c"));
  assert.throws(() => requireBranch(actor, "b", true));
  assert.deepEqual(
    actorFromMember({ ...member, staff: { ...member.staff, active: false } })
      .branchIds,
    [],
  );
});
