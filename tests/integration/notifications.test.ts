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
  MAX_ATTEMPTS,
  processNotifications,
  providerMissing,
} from "../../lib/notifications/dispatch";
import type { SmsProvider } from "../../lib/notifications/provider";
import { readNotificationLog } from "../../lib/services/notifications";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
test("booking notifications outbox", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55489),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    // Rescheduling uses the real clock, so stay inside the booking horizon.
    const date = addDays(localStamp(new Date()).slice(0, 10), 40),
      clock = {};
    const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
    const at = (time: string) => localInstant(`${date}T${time}`).toISOString();
    const guest = (time: string, extra = {}) =>
      createVisit(
        db,
        "salon-a",
        {
          branchId: "z",
          items: [{ serviceId: "book-service-a-60" }],
          startAt: at(time),
          customer: { name: "Сараа", phone: "88112233" },
          idempotencyKey: randomUUID(),
          ...extra,
        },
        clock,
      );
    const notices = () =>
      db.notification.findMany({
        where: { salonId: "a" },
        orderBy: { createdAt: "asc" },
      });
    await t.test(
      "nothing is queued while a salon has notifications off",
      async () => {
        await guest("10:00");
        assert.equal((await notices()).length, 0);
      },
    );
    await t.test(
      "changes queue one Mongolian SMS each, in the same transaction",
      async () => {
        await saveBookingSettings(db, actors.owner, {
          ...defaultBookingSettings,
          notificationsEnabled: true,
        });
        const key = randomUUID();
        const [booking] = await guest("11:00", { idempotencyKey: key });
        await guest("11:00", { idempotencyKey: key }); // replay: no second notice
        let rows = await notices();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].event, "BOOKING_RECEIVED");
        assert.equal(rows[0].recipient, "+97688112233");
        assert.match(
          rows[0].body,
          new RegExp(`^Туршилтын салон: ${md} 11:00 Хумс арчилгаа захиалгыг хүлээн авлаа`),
        );
        const confirmed = await changeBooking(db, actors.owner, booking.id, {
          action: "status",
          status: "CONFIRMED",
          version: booking.version,
        });
        const moved = await changeBooking(db, actors.owner, booking.id, {
          action: "reschedule",
          startAt: at("15:00"),
          version: confirmed.version,
        });
        await changeBooking(db, actors.owner, booking.id, {
          action: "status",
          status: "CANCELLED",
          version: moved.version,
        });
        rows = await notices();
        assert.deepEqual(
          rows.map((r) => r.event),
          [
            "BOOKING_RECEIVED",
            "BOOKING_CONFIRMED",
            "BOOKING_RESCHEDULED",
            "BOOKING_CANCELLED",
          ],
        );
        assert.match(rows[2].body, new RegExp(`${md} 15:00 болж өөрчлөгдлөө`));
        assert.match(rows[3].body, /Лавлах: 99112233/);
      },
    );
    await t.test("a failed booking leaves no notice behind", async () => {
      const before = (await notices()).length;
      await createBooking(
        db,
        { actor: actors.owner },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-1",
          startAt: at("12:00"),
          customer: { name: "Номин", phone: "99001122" },
          idempotencyKey: randomUUID(),
        },
        clock,
      );
      await assert.rejects(
        createBooking(
          db,
          { actor: actors.owner },
          {
            branchId: "z",
            serviceId: "book-service-a-60",
            staffId: "book-staff-a-1",
            startAt: at("12:00"),
            customer: { name: "Номин", phone: "99001122" },
            idempotencyKey: randomUUID(),
          },
          clock,
        ),
        (e: unknown) => e instanceof HttpError && e.status === 409,
      );
      assert.equal((await notices()).length, before + 1);
    });
    await t.test("a two-service visit sends one combined message", async () => {
      await db.notification.deleteMany({});
      await createVisit(
        db,
        "salon-a",
        {
          branchId: "z",
          items: [
            { serviceId: "book-service-a-90" },
            { serviceId: "book-service-a-60" },
          ],
          startAt: at("16:00"),
          customer: { name: "Зэрэг", phone: "80112233" },
          idempotencyKey: randomUUID(),
        },
        clock,
      );
      const rows = await notices();
      assert.equal(rows.length, 1);
      assert.match(rows[0].body, /Гел маникюр, Хумс арчилгаа/);
    });
    await t.test(
      "delivery: sent once, retried with backoff, then failed",
      async () => {
        const sent: string[] = [];
        const ok: SmsProvider = {
          name: "fake",
          async send(to) {
            sent.push(to);
            return { messageId: "m1" };
          },
        };
        assert.deepEqual(await processNotifications(db, ok), {
          claimed: 1,
          sent: 1,
        });
        assert.deepEqual(await processNotifications(db, ok), {
          claimed: 0,
          sent: 0,
        });
        assert.equal(sent.length, 1);
        const [row] = await notices();
        assert.equal(row.status, "SENT");
        assert.equal(row.providerMessageId, "m1");
        const failing: SmsProvider = {
          name: "down",
          async send() {
            throw new Error("Үйлчилгээ хариу өгсөнгүй");
          },
        };
        await db.notification.update({
          where: { id: row.id },
          data: { status: "PENDING", attempts: 0 },
        });
        let now = new Date();
        for (let i = 1; i <= MAX_ATTEMPTS; i++) {
          await processNotifications(db, failing, { now });
          const r = await db.notification.findUniqueOrThrow({
            where: { id: row.id },
          });
          assert.equal(r.attempts, i);
          assert.equal(r.status, i < MAX_ATTEMPTS ? "PENDING" : "FAILED");
          // Not due again until the backoff has passed.
          assert.deepEqual(await processNotifications(db, failing, { now }), {
            claimed: 0,
            sent: 0,
          });
          now = new Date(+r.availableAt + 1000);
        }
        await db.notification.update({
          where: { id: row.id },
          data: { status: "PENDING" },
        });
        await processNotifications(db, null, { now });
        const skipped = await db.notification.findUniqueOrThrow({
          where: { id: row.id },
        });
        assert.equal(skipped.status, "SKIPPED");
        assert.equal(skipped.lastError, providerMissing);
      },
    );
    await t.test(
      "only owners read the log, with masked phone numbers",
      async () => {
        const log = await readNotificationLog(db, actors.owner);
        assert.ok(log.length >= 1);
        assert.ok(log.every((n) => /^••••\d{4}$/.test(n.recipient)));
        await assert.rejects(
          readNotificationLog(db, actors.reception),
          (e: unknown) => e instanceof HttpError && e.status === 403,
        );
        assert.deepEqual(await readNotificationLog(db, actors.other), []);
      },
    );
  } finally {
    await fixture.close();
  }
});
