import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking } from "../../lib/services/bookings";
import {
  assignStaff,
  createVisit,
  visitAvailability,
  visitReceipt,
} from "../../lib/services/visits";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import { localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const conflict = (e: unknown) => e instanceof HttpError && e.status === 409;
test("staff assignment backtracks to keep services on different people", () => {
  assert.deepEqual(assignStaff([["x", "y"], ["x"]]), ["y", "x"]);
  assert.deepEqual(assignStaff([["x"], ["x"]]), null);
  assert.deepEqual(
    assignStaff([
      ["x", "y"],
      ["x", "y"],
    ]),
    ["x", "y"],
  );
  assert.deepEqual(assignStaff([["y"]]), ["y"]);
});
test("parallel two-service visits", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55487),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = "2030-04-09",
      clock = { now: () => localInstant(`${date}T08:00`) };
    const both = [
      { serviceId: "book-service-a-90" },
      { serviceId: "book-service-a-60" },
    ];
    const at = (time: string) => localInstant(`${date}T${time}`).toISOString();
    const visit = (time: string, extra = {}) => ({
      branchId: "z",
      items: both,
      startAt: at(time),
      customer: { name: "Сараа", phone: "88112233" },
      idempotencyKey: randomUUID(),
      ...extra,
    });
    const times = async (items = both) =>
      (
        await visitAvailability(
          db,
          "salon-a",
          { branchId: "z", date, items },
          clock,
        )
      ).slots.map((s) => localStamp(s.startAt).slice(11));
    await t.test(
      "both services start together with two different staff",
      async () => {
        assert.ok((await times()).includes("10:00"));
        const input = visit("10:00");
        const made = await createVisit(db, "salon-a", input, clock);
        assert.equal(made.length, 2);
        assert.notEqual(made[0].staffId, made[1].staffId);
        assert.equal(+made[0].startAt, +made[1].startAt);
        assert.ok(made[0].groupId && made[0].groupId === made[1].groupId);
        assert.deepEqual(
          made.map((b) => b.durationMinutesSnapshot),
          [90, 60],
        );
        assert.ok(
          made.every((b) => b.status === "PENDING" && b.source === "ONLINE"),
        );
        const replay = await createVisit(db, "salon-a", input, clock);
        assert.deepEqual(
          replay.map((b) => b.id).sort(),
          made.map((b) => b.id).sort(),
        );
        await assert.rejects(
          createVisit(db, "salon-a", { ...input, startAt: at("15:00") }, clock),
          conflict,
        );
        const receipt = await visitReceipt(db, made);
        assert.equal(receipt.totalMnt, 130000);
        assert.equal(receipt.items.length, 2);
        assert.equal(receipt.deposit, null);
      },
    );
    await t.test("a visit needs two free people at the same time", async () => {
      // Both staff are busy 10:00–11:30/11:00 from the first visit.
      assert.ok(!(await times()).includes("10:30"));
      await createBooking(
        db,
        { slug: "salon-a" },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-1",
          startAt: at("15:00"),
          customer: { name: "Номин", phone: "99112233" },
          idempotencyKey: randomUUID(),
        },
        clock,
      );
      // One staff is still free at 15:00, but a visit needs two.
      assert.ok(!(await times()).includes("15:00"));
      assert.ok(
        (await times([{ serviceId: "book-service-a-60" }])).includes("15:00"),
      );
      await assert.rejects(
        createVisit(db, "salon-a", visit("15:00"), clock),
        conflict,
      );
      assert.equal(
        await db.booking.count({
          where: { salonId: "a", startAt: new Date(at("15:00")) },
        }),
        1,
      );
    });
    await t.test("invalid selections are rejected before booking", async () => {
      for (const items of [
        [],
        [
          { serviceId: "book-service-a-90" },
          { serviceId: "book-service-a-90" },
        ],
        [
          { serviceId: "book-service-a-90", staffId: "book-staff-a-1" },
          { serviceId: "book-service-a-60", staffId: "book-staff-a-1" },
        ],
        [...both, { serviceId: "book-service-a-90" }],
      ])
        await assert.rejects(
          createVisit(db, "salon-a", visit("16:00", { items }), clock),
        );
      // Another salon's service never resolves through this slug.
      await assert.rejects(
        createVisit(
          db,
          "salon-a",
          visit("16:00", { items: [{ serviceId: "book-service-b-60" }] }),
          clock,
        ),
      );
    });
    await t.test("deposits add up across the visit", async () => {
      await saveBookingSettings(db, actors.owner, {
        ...defaultBookingSettings,
        depositRequired: true,
        depositValue: 30,
        depositBankName: "Хаан банк",
        depositAccountNumber: "5000123456",
        depositAccountHolder: "Салон ХХК",
      });
      const made = await createVisit(db, "salon-a", visit("16:30"), clock);
      const receipt = await visitReceipt(db, made);
      assert.equal(receipt.deposit?.amountMnt, 19500 * 2);
      assert.equal(receipt.status, "PENDING");
    });
  } finally {
    await fixture.close();
  }
});
