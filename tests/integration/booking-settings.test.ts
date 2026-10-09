import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  readBookingSettings,
  saveBookingSettings,
} from "../../lib/services/booking-settings";
import {
  defaultBookingSettings,
  publicBookingClosed,
} from "../../lib/booking-settings";
import {
  availability,
  createBooking,
  publicCatalog,
} from "../../lib/services/bookings";
import { localInstant, addDays } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;
test("Phase 4.1 salon booking policies", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55482),
    { db, pg } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = "2030-01-07",
      clock = { now: () => localInstant(`${date}T08:00`) };
    const query = {
      branchId: "z",
      serviceId: "book-service-a-90",
      staffId: "book-staff-a-1",
      date,
    };
    const at = (day: string, time = "10:00") =>
      localInstant(`${day}T${time}`).toISOString();
    const input = (day = date, time = "10:00") => ({
      branchId: query.branchId,
      serviceId: query.serviceId,
      staffId: query.staffId,
      startAt: at(day, time),
      customer: { name: "Номин", phone: "99112233" },
      idempotencyKey: randomUUID(),
    });
    const save = (extra: Partial<typeof defaultBookingSettings>) =>
      saveBookingSettings(db, actors.owner, {
        ...defaultBookingSettings,
        ...extra,
      });
    await t.test(
      "future salon inserts receive safe Phase 3 defaults automatically",
      async () => {
        assert.equal(await db.bookingSettings.count(), 2);
        assert.deepEqual(
          await readBookingSettings(db, actors.owner),
          defaultBookingSettings,
        );
        const result = await availability(
          db,
          { slug: "salon-a" },
          query,
          clock,
        );
        assert.ok(result.slots.some((s) => s.startAt === at(date, "10:15")));
      },
    );
    await t.test(
      "tenant isolation, strict input and owner-only updates",
      async () => {
        for (const actor of [actors.manager, actors.reception, actors.staff]) {
          await assert.rejects(
            saveBookingSettings(db, actor, defaultBookingSettings),
            denied(403),
          );
          await assert.rejects(readBookingSettings(db, actor), denied(403));
        }
        await assert.rejects(
          saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            salonId: "b",
          }),
        );
        await save({ advanceBookingDays: 30, cancellationNoticeMinutes: 360 });
        assert.deepEqual(
          await readBookingSettings(db, actors.other),
          defaultBookingSettings,
        );
        assert.equal(
          (await readBookingSettings(db, actors.owner))
            .cancellationNoticeMinutes,
          360,
        );
      },
    );
    await t.test(
      "closed public creation and availability fail, manual booking continues",
      async () => {
        await save({
          publicBookingEnabled: false,
          advanceBookingDays: 0,
          minimumBookingNoticeMinutes: 525600,
        });
        await assert.rejects(
          availability(db, { slug: "salon-a" }, query, clock),
          denied(403),
        );
        await assert.rejects(
          createBooking(db, { slug: "salon-a" }, input(), clock),
          (e) => e instanceof HttpError && e.message === publicBookingClosed,
        );
        const catalog = await publicCatalog(db, "salon-a");
        assert.deepEqual(catalog.branches, []);
        assert.deepEqual(catalog.staff, []);
        assert.deepEqual(catalog.services, []);
        const manual = await createBooking(
          db,
          { actor: actors.reception },
          input(addDays(date, 40)),
          clock,
        );
        assert.equal(manual.status, "CONFIRMED");
      },
    );
    await t.test(
      "advance window uses business-local inclusive day boundary and rechecks creation",
      async () => {
        await save({ advanceBookingDays: 30 });
        const boundary = addDays(date, 30),
          beyond = addDays(date, 31);
        assert.ok(
          (
            await availability(
              db,
              { slug: "salon-a" },
              { ...query, date: boundary },
              clock,
            )
          ).slots.length,
        );
        const booking = await createBooking(
          db,
          { slug: "salon-a" },
          input(boundary),
          clock,
        );
        assert.equal(booking.status, "PENDING");
        await assert.rejects(
          availability(
            db,
            { slug: "salon-a" },
            { ...query, date: beyond },
            clock,
          ),
          denied(400),
        );
        await assert.rejects(
          createBooking(db, { slug: "salon-a" }, input(beyond), clock),
          denied(400),
        );
        await save({ advanceBookingDays: 0 });
        assert.ok(
          (await availability(db, { slug: "salon-a" }, query, clock)).slots
            .length,
        );
        await assert.rejects(
          createBooking(
            db,
            { slug: "salon-a" },
            input(addDays(date, 1)),
            clock,
          ),
          denied(400),
        );
      },
    );
    await t.test(
      "minimum notice exact boundary, elapsed time recheck and UTC-local day",
      async () => {
        await save({ minimumBookingNoticeMinutes: 120 });
        assert.ok(
          (
            await availability(db, { slug: "salon-a" }, query, clock)
          ).slots.some((s) => s.startAt === at(date)),
        );
        const later = { now: () => localInstant(`${date}T08:01`) };
        assert.ok(
          !(
            await availability(db, { slug: "salon-a" }, query, later)
          ).slots.some((s) => s.startAt === at(date)),
        );
        await assert.rejects(
          createBooking(db, { slug: "salon-a" }, input(), later),
          denied(409),
        );
        const booking = await createBooking(
          db,
          { slug: "salon-a" },
          input(),
          clock,
        );
        assert.equal(booking.status, "PENDING");
        const midnight = { now: () => new Date("2030-01-06T16:01:00Z") };
        await save({ advanceBookingDays: 0 });
        assert.ok(
          (
            await availability(
              db,
              { slug: "salon-a" },
              { ...query, staffId: "book-staff-a-2" },
              midnight,
            )
          ).slots.length,
        );
      },
    );
    await t.test(
      "15/30 interval shared by public and manual with server rejection off-grid",
      async () => {
        const day = addDays(date, 2);
        await save({ slotIntervalMinutes: 15 });
        assert.ok(
          (
            await availability(
              db,
              { slug: "salon-a" },
              { ...query, date: day },
              clock,
            )
          ).slots.some((s) => s.startAt === at(day, "10:15")),
        );
        await save({ slotIntervalMinutes: 30 });
        for (const context of [{ slug: "salon-a" }, { actor: actors.owner }]) {
          const values = await availability(
            db,
            context,
            { ...query, date: day },
            clock,
          );
          assert.ok(values.slots.some((s) => s.startAt === at(day, "10:30")));
          assert.ok(!values.slots.some((s) => s.startAt === at(day, "10:15")));
          await assert.rejects(
            createBooking(db, context, input(day, "10:15"), clock),
            denied(409),
          );
        }
      },
    );
    await t.test(
      "automatic confirmation and manual confirmation preserve existing bookings",
      async () => {
        await save({ bookingConfirmationMode: "AUTO_CONFIRM" });
        const auto = await createBooking(
          db,
          { slug: "salon-a" },
          input(addDays(date, 3)),
          clock,
        );
        assert.equal(auto.status, "CONFIRMED");
        await save({ bookingConfirmationMode: "MANUAL_CONFIRM" });
        const manual = await createBooking(
          db,
          { slug: "salon-a" },
          input(addDays(date, 4)),
          clock,
        );
        assert.equal(manual.status, "PENDING");
        assert.equal(
          (await db.booking.findUniqueOrThrow({ where: { id: auto.id } }))
            .status,
          "CONFIRMED",
        );
        await save({});
      },
    );
    await t.test(
      "database enforces policy bounds and denies browser roles",
      async () => {
        for (const data of [
          { slotIntervalMinutes: 20 },
          { advanceBookingDays: -1 },
          { minimumBookingNoticeMinutes: -1 },
          { cancellationNoticeMinutes: 525601 },
        ])
          await assert.rejects(
            db.bookingSettings.update({ where: { salonId: "a" }, data }),
          );
        // PGlite shares one session with Prisma's socket connection, which a
        // constraint error can leave inside an aborted transaction.
        await pg.exec("ROLLBACK");
        for (const role of ["anon", "authenticated"]) {
          await pg.exec(`SET ROLE ${role}`);
          await assert.rejects(pg.query('SELECT * FROM "BookingSettings"'));
          await pg.exec("RESET ROLE");
        }
      },
    );
  } finally {
    await fixture.close();
  }
});
