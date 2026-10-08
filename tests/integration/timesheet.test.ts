import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { availability, createBooking } from "../../lib/services/bookings";
import { readTimesheet, setAttendance } from "../../lib/services/timesheet";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import { localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "timesheet marks and salon-hours mode drive availability",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55486),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const date = "2030-03-12",
        clock = { now: () => localInstant(`${date}T08:00`) };
      const query = {
        branchId: "z",
        serviceId: "book-service-a-60",
        staffId: "book-staff-a-1",
        date,
      };
      const times = async () =>
        (
          await availability(db, { actor: actors.owner }, query, clock)
        ).slots.map((s) => localStamp(s.startAt).slice(11));
      const mark = (
        actor: typeof actors.owner,
        status: "WORKED" | "OFF" | null,
        extra = {},
      ) =>
        setAttendance(
          db,
          actor,
          { staffId: "book-staff-a-1", date, status, ...extra },
          localInstant(`${date}T20:00`),
        );
      await t.test(
        "a day off removes the staff member from availability",
        async () => {
          assert.ok((await times()).includes("10:00"));
          await mark(actors.reception, "OFF");
          assert.deepEqual(await times(), []);
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.owner },
              {
                branchId: "z",
                serviceId: "book-service-a-60",
                staffId: "book-staff-a-1",
                startAt: localInstant(`${date}T10:00`).toISOString(),
                customer: { name: "Номин", phone: "99112233" },
                idempotencyKey: randomUUID(),
              },
              clock,
            ),
            status(409),
          );
          await mark(actors.reception, null);
          assert.ok((await times()).includes("10:00"));
        },
      );
      await t.test(
        "marking a booked day off needs confirmation and keeps bookings",
        async () => {
          const booking = await createBooking(
            db,
            { actor: actors.owner },
            {
              branchId: "z",
              serviceId: "book-service-a-60",
              staffId: "book-staff-a-1",
              startAt: localInstant(`${date}T11:00`).toISOString(),
              customer: { name: "Номин", phone: "99112233" },
              idempotencyKey: randomUUID(),
            },
            clock,
          );
          await assert.rejects(mark(actors.owner, "OFF"), status(409));
          await mark(actors.owner, "OFF", { confirm: true });
          assert.equal(
            (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
              .status,
            "CONFIRMED",
          );
          await mark(actors.owner, "WORKED");
          const sheet = await readTimesheet(db, actors.owner, {
            from: "2030-03-01",
            to: "2030-03-31",
          });
          assert.deepEqual(sheet.marks, [
            { staffId: "book-staff-a-1", date, status: "WORKED" },
          ]);
        },
      );
      await t.test("future days cannot be marked worked", async () => {
        await assert.rejects(
          setAttendance(
            db,
            actors.owner,
            { staffId: "book-staff-a-1", date: "2030-03-20", status: "WORKED" },
            localInstant(`${date}T20:00`),
          ),
          status(400),
        );
      });
      await t.test(
        "only owner, manager and reception mark, within their salon",
        async () => {
          await assert.rejects(mark(actors.staff, "OFF"), status(403));
          await assert.rejects(mark(actors.other, "OFF"), status(404));
          await assert.rejects(
            readTimesheet(db, actors.staff, {
              from: "2030-03-01",
              to: "2030-03-31",
            }),
            status(403),
          );
          const other = await readTimesheet(db, actors.other, {
            from: "2030-03-01",
            to: "2030-03-31",
          });
          assert.ok(other.staff.every((s) => !s.id.startsWith("book-staff-a")));
          assert.deepEqual(other.marks, []);
          await assert.rejects(
            readTimesheet(db, actors.owner, {
              from: "2030-01-01",
              to: "2030-04-30",
            }),
          );
        },
      );
      await t.test(
        "salon-hours mode uses branch opening hours instead of shifts",
        async () => {
          await mark(actors.owner, null);
          await db.booking.deleteMany({ where: { salonId: "a" } });
          // Weekly shift is 10:00–18:00 with a 13:00–14:00 break; branch is 10:00–19:00.
          const custom = await times();
          assert.ok(!custom.includes("13:00") && !custom.includes("18:00"));
          await saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            staffHoursMode: "SALON_HOURS",
          });
          const salon = await times();
          assert.equal(salon[0], "10:00");
          assert.ok(salon.includes("13:00") && salon.includes("18:00"));
          assert.ok(!salon.includes("18:15"));
          await mark(actors.owner, "OFF");
          assert.deepEqual(await times(), []);
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
