import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { changeBooking, createBooking } from "../../lib/services/bookings";
import { createVisit } from "../../lib/services/visits";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import {
  notificationsOff,
  processNotifications,
  reminderNotNeeded,
} from "../../lib/notifications/dispatch";
import { reminderWithdrawn } from "../../lib/notifications/outbox";
import type { SmsProvider } from "../../lib/notifications/provider";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("appointment reminders", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55492),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = addDays(localStamp(new Date()).slice(0, 10), 5);
    const at = (time: string, day = date) =>
      localInstant(`${day}T${time}`).toISOString();
    const settings = (extra = {}) =>
      saveBookingSettings(db, actors.owner, {
        ...defaultBookingSettings,
        notificationsEnabled: true,
        reminderMinutes: [1440, 120],
        ...extra,
      });
    const desk = (time: string, phone = "99001122") =>
      createBooking(
        db,
        { actor: actors.owner },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-1",
          startAt: at(time),
          customer: { name: "Номин", phone },
          idempotencyKey: randomUUID(),
        },
      );
    const reminders = (bookingId: string) =>
      db.notification.findMany({
        where: { bookingId, event: "BOOKING_REMINDER" },
        orderBy: { availableAt: "asc" },
      });
    const sent: string[] = [];
    const provider: SmsProvider = {
      name: "fake",
      async send(_to, body) {
        sent.push(body);
        return {};
      },
    };
    await t.test("bookings schedule one reminder per lead time", async () => {
      await settings();
      const b = await desk("10:00");
      const rows = await reminders(b.id);
      assert.deepEqual(
        rows.map((r) => [+b.startAt - +r.availableAt, r.status]),
        [
          [1440 * 60000, "PENDING"],
          [120 * 60000, "PENDING"],
        ],
      );
      assert.match(
        rows[0].body,
        /Сануулга\. Таны цаг .* 10:00, Хумс арчилгаа\. Зайсан\./,
      );
    });
    await t.test(
      "rescheduling replaces reminders; cancelling withdraws them",
      async () => {
        const b = await desk("12:00", "99001133");
        const moved = await changeBooking(db, actors.owner, b.id, {
          action: "reschedule",
          startAt: at("15:00"),
          version: b.version,
        });
        let rows = await reminders(b.id);
        assert.equal(rows.filter((r) => r.status === "PENDING").length, 2);
        assert.ok(
          rows
            .filter((r) => r.status === "SKIPPED")
            .every((r) => r.lastError === reminderWithdrawn),
        );
        assert.ok(
          rows
            .filter((r) => r.status === "PENDING")
            .every((r) => r.dedupeKey.endsWith(moved.startAt.toISOString())),
        );
        await changeBooking(db, actors.owner, b.id, {
          action: "status",
          status: "CANCELLED",
          version: moved.version,
        });
        rows = await reminders(b.id);
        assert.equal(rows.filter((r) => r.status === "PENDING").length, 0);
      },
    );
    await t.test(
      "confirming keeps reminders; a visit gets one per lead time",
      async () => {
        const [online] = await createVisit(db, "salon-a", {
          branchId: "z",
          items: [
            { serviceId: "book-service-a-90" },
            { serviceId: "book-service-a-60" },
          ],
          startAt: at("16:30"),
          customer: { name: "Сараа", phone: "88112233" },
          idempotencyKey: randomUUID(),
        });
        assert.equal((await reminders(online.id)).length, 2);
        await changeBooking(db, actors.owner, online.id, {
          action: "status",
          status: "CONFIRMED",
          version: online.version,
        });
        assert.equal((await reminders(online.id)).length, 2);
      },
    );
    await t.test(
      "nothing is scheduled for lead times already passed",
      async () => {
        // Tomorrow 10:00 is always less than two days away, whatever the clock.
        await settings({ reminderMinutes: [2880, 60] });
        const tomorrow = addDays(localStamp(new Date()).slice(0, 10), 1);
        const b = await createBooking(
          db,
          { actor: actors.owner },
          {
            branchId: "z",
            serviceId: "book-service-a-60",
            staffId: "book-staff-a-2",
            startAt: at("10:00", tomorrow),
            customer: { name: "Түргэн", phone: "99001144" },
            idempotencyKey: randomUUID(),
          },
        );
        const rows = await reminders(b.id);
        assert.deepEqual(
          rows.map((r) => +b.startAt - +r.availableAt),
          [60 * 60000],
        );
        await settings();
      },
    );
    await t.test("delivery re-checks status and the salon switch", async () => {
      const b = await desk("11:00", "99001155");
      const [early] = await reminders(b.id);
      const due = new Date(+early.availableAt + 1000);
      await processNotifications(db, provider, { now: due, limit: 100 });
      assert.equal(
        (await db.notification.findUniqueOrThrow({ where: { id: early.id } }))
          .status,
        "SENT",
      );
      assert.ok(sent.some((body) => body.includes("11:00")));
      // A pending online booking is not reminded.
      const [pending] = await createVisit(db, "salon-a", {
        branchId: "z",
        items: [{ serviceId: "book-service-a-60" }],
        startAt: at("14:00"),
        customer: { name: "Хүлээгдэж", phone: "88112299" },
        idempotencyKey: randomUUID(),
      });
      const [r] = await reminders(pending.id);
      await processNotifications(db, provider, {
        now: new Date(+r.availableAt + 1000),
        limit: 100,
      });
      const skipped = await db.notification.findUniqueOrThrow({
        where: { id: r.id },
      });
      assert.equal(skipped.status, "SKIPPED");
      assert.equal(skipped.lastError, reminderNotNeeded);
      // Turning notifications off stops what is still queued.
      await settings({ notificationsEnabled: false });
      const [late] = (await reminders(b.id)).filter(
        (x) => x.status === "PENDING",
      );
      await processNotifications(db, provider, {
        now: new Date(+late.availableAt + 1000),
        limit: 100,
      });
      assert.equal(
        (await db.notification.findUniqueOrThrow({ where: { id: late.id } }))
          .lastError,
        notificationsOff,
      );
    });
    await t.test("only the offered lead times are accepted", async () => {
      await assert.rejects(settings({ reminderMinutes: [30] }));
      await assert.rejects(
        db.bookingSettings.update({
          where: { salonId: "a" },
          data: { reminderMinutes: [30] },
        }),
      );
      await fixture.settle();
      const saved = await settings({ reminderMinutes: [60, 2880, 60] });
      assert.deepEqual(saved.reminderMinutes, [2880, 60]);
    });
  } finally {
    await fixture.close();
  }
});
