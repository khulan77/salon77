import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking } from "../../lib/services/bookings";
import { createVisit, hashManageToken } from "../../lib/services/visits";
import {
  changeManagedVisit,
  managedAvailability,
  readManagedVisit,
} from "../../lib/services/manage";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number, text?: RegExp) => (e: unknown) =>
  e instanceof HttpError &&
  e.status === code &&
  (!text || text.test(e.message));
test(
  "guest self-service through the private manage link",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55493),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      await saveBookingSettings(db, actors.owner, {
        ...defaultBookingSettings,
        notificationsEnabled: true,
        reminderMinutes: [],
      });
      const date = addDays(localStamp(new Date()).slice(0, 10), 6);
      const at = (time: string) =>
        localInstant(`${date}T${time}`).toISOString();
      const key = randomUUID();
      const input = {
        branchId: "z",
        items: [
          { serviceId: "book-service-a-90" },
          { serviceId: "book-service-a-60" },
        ],
        startAt: at("10:00"),
        customer: { name: "Сараа", phone: "88112233" },
        idempotencyKey: key,
      };
      const made = await createVisit(db, "salon-a", input);
      const token = made.manageToken!;
      await t.test(
        "the token is private, shared by the visit, and stored hashed",
        async () => {
          assert.match(token, /^[A-Za-z0-9_-]{43}$/);
          assert.ok(
            made.every((b) => b.manageTokenHash === hashManageToken(token)),
          );
          assert.ok(made.every((b) => b.manageTokenHash !== token));
          assert.equal(
            (await createVisit(db, "salon-a", input)).manageToken,
            null,
          );
          const v = await readManagedVisit(db, "salon-a", token);
          assert.equal(v.items.length, 2);
          assert.equal(v.status, "PENDING");
          assert.equal(v.canChange, true);
          assert.ok(!JSON.stringify(v).includes("88112233"));
          for (const [slug, bad] of [
            ["salon-a", "x".repeat(43)],
            ["salon-a", "short"],
            ["salon-b", token],
          ])
            await assert.rejects(readManagedVisit(db, slug, bad), status(404));
        },
      );
      await t.test(
        "moving keeps staff and durations and frees the old time",
        async () => {
          const open = (
            await managedAvailability(db, "salon-a", { token, date })
          ).slots.map((s) => localStamp(s.startAt).slice(11));
          assert.ok(open.includes("10:00") && open.includes("15:00"));
          const moved = await changeManagedVisit(db, "salon-a", {
            action: "reschedule",
            token,
            startAt: at("15:00"),
          });
          assert.deepEqual(
            moved.map((b) => [
              b.staffId,
              localStamp(b.startAt).slice(11),
              localStamp(b.endAt).slice(11),
            ]),
            made.map((b) => [
              b.staffId,
              "15:00",
              b.durationMinutesSnapshot === 90 ? "16:30" : "16:00",
            ]),
          );
          assert.ok(moved.every((b, i) => b.version === made[i].version + 1));
          const notice = await db.notification.findFirst({
            where: { bookingId: made[0].id, event: "BOOKING_RESCHEDULED" },
          });
          assert.ok(notice);
          // The old 10:00 slot is free again for others.
          await createBooking(
            db,
            { actor: actors.owner },
            {
              branchId: "z",
              serviceId: "book-service-a-60",
              staffId: made[0].staffId,
              startAt: at("10:00"),
              customer: { name: "Номин", phone: "99001122" },
              idempotencyKey: randomUUID(),
            },
          );
          // A taken time is refused.
          await assert.rejects(
            changeManagedVisit(db, "salon-a", {
              action: "reschedule",
              token,
              startAt: at("10:00"),
            }),
            status(409),
          );
        },
      );
      await t.test(
        "the salon's notice period closes self-service",
        async () => {
          await saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            cancellationNoticeMinutes: 10 * 24 * 60,
          });
          const v = await readManagedVisit(db, "salon-a", token);
          assert.equal(v.canChange, false);
          assert.deepEqual(
            (await managedAvailability(db, "salon-a", { token, date })).slots,
            [],
          );
          await assert.rejects(
            changeManagedVisit(db, "salon-a", { action: "cancel", token }),
            status(409, /Салон руу залгана уу: 99112233/),
          );
          await saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            notificationsEnabled: true,
            reminderMinutes: [],
          });
        },
      );
      await t.test("cancelling releases the whole visit once", async () => {
        const cancelled = await changeManagedVisit(db, "salon-a", {
          action: "cancel",
          token,
        });
        assert.ok(cancelled.every((b) => b.status === "CANCELLED"));
        assert.equal(
          (await readManagedVisit(db, "salon-a", token)).status,
          "CANCELLED",
        );
        await assert.rejects(
          changeManagedVisit(db, "salon-a", { action: "cancel", token }),
          status(409, /аль хэдийн цуцлагдсан/),
        );
        await assert.rejects(
          changeManagedVisit(db, "salon-a", {
            action: "cancel",
            token,
            extra: 1,
          }),
        );
      });
    } finally {
      await fixture.close();
    }
  },
);
