import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { BookingStatus } from "@prisma/client";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { revenueReport } from "../../lib/services/reports";
import { completePastBookings } from "../../lib/services/auto-complete";
import { changeBooking, listBookings } from "../../lib/services/bookings";
import {
  changeSalonSlug,
  updateSalonDetails,
} from "../../lib/services/salon-profile";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;
test(
  "past confirmed visits count in reports; owners rename the salon",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55510),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const today = localStamp(new Date()).slice(0, 10),
        yesterday = addDays(today, -1),
        tomorrow = addDays(today, 1),
        range = { from: addDays(today, -3), to: addDays(today, 3) };
      for (const salonId of ["a", "b"])
        await db.customer.create({
          data: {
            id: `ac-${salonId}`,
            salonId,
            name: "Сараа",
            phone: "+97688112233",
          },
        });
      let n = 0;
      const book = (
        salonId: string,
        branchId: string,
        at: string,
        status: BookingStatus,
        staff: number,
        duration: 60 | 90,
        price: number,
        extraMnt = 0,
      ) => {
        const startAt = localInstant(at);
        return db.booking.create({
          data: {
            salonId,
            branchId,
            customerId: `ac-${salonId}`,
            serviceId: `book-service-${salonId}-${duration}`,
            staffId: `book-staff-${salonId}-${staff}`,
            startAt,
            endAt: new Date(+startAt + duration * 60000),
            status,
            source: "OWNER",
            serviceNameSnapshot:
              duration === 90 ? "Гел маникюр" : "Хумс арчилгаа",
            durationMinutesSnapshot: duration,
            priceSnapshot: price,
            extraMnt,
            customerNameSnapshot: "Сараа",
            customerPhoneSnapshot: "+97688112233",
            idempotencyKey: randomUUID(),
            requestHash: String(n++),
          },
        });
      };
      const done1 = await book(
        "a",
        "z",
        `${yesterday}T10:00`,
        "CONFIRMED",
        1,
        60,
        65000,
      );
      await book(
        "a",
        "z",
        `${yesterday}T12:00`,
        "CONFIRMED",
        2,
        90,
        40000,
        5000,
      );
      await book("a", "z", `${yesterday}T15:00`, "PENDING", 1, 60, 30000);
      await book("a", "z", `${tomorrow}T10:00`, "CONFIRMED", 1, 90, 70000);
      // Salon B opted out: its past visit stays confirmed.
      await saveBookingSettings(db, actors.other, {
        ...defaultBookingSettings,
        autoCompletePast: false,
      });
      await book("b", "other", `${yesterday}T10:00`, "CONFIRMED", 1, 60, 99000);

      await t.test(
        "report completes past visits and splits by staff and service",
        async () => {
          const r = await revenueReport(db, actors.owner, range);
          assert.equal(r.revenue, 110000);
          assert.equal(r.completed, 2);
          assert.deepEqual(
            r.byStaff.map((s) => [s.name, s.count, s.revenue]),
            [
              ["Ану", 1, 65000],
              ["Болор", 1, 45000],
            ],
          );
          assert.deepEqual(
            r.byService.map((s) => [s.name, s.revenue]),
            [
              ["Хумс арчилгаа", 65000],
              ["Гел маникюр", 45000],
            ],
          );
          assert.equal(r.expected, 70000);
          assert.equal(r.expectedCount, 1);
          const pending = await db.booking.count({
            where: { salonId: "a", status: "PENDING" },
          });
          assert.equal(pending, 1, "unconfirmed visits are never completed");
        },
      );
      await t.test("opted-out and other salons are untouched", async () => {
        const b = await revenueReport(db, actors.other, range);
        assert.equal(b.revenue, 0);
        assert.equal(b.expected, 99000);
        assert.equal(await completePastBookings(db), 0);
      });
      await t.test(
        "an auto-completed visit can be corrected to no-show",
        async () => {
          const row = await db.booking.findUniqueOrThrow({
            where: { id: done1.id },
          });
          assert.equal(row.status, "COMPLETED");
          await changeBooking(db, actors.owner, done1.id, {
            action: "status",
            status: "NO_SHOW",
            version: row.version,
          });
          const r = await revenueReport(db, actors.owner, range);
          assert.equal(r.revenue, 45000);
          assert.equal(r.noShow, 1);
        },
      );
      await t.test("the calendar also closes past visits", async () => {
        await book("a", "z", `${yesterday}T17:00`, "CONFIRMED", 2, 60, 20000);
        const rows = await listBookings(db, actors.owner, {
          date: yesterday,
          days: 1,
        });
        assert.ok(rows.every((b) => b.status !== "CONFIRMED"));
      });
      await t.test(
        "owner edits name, phone and introduction; link stays",
        async () => {
          const saved = await updateSalonDetails(db, actors.owner, {
            name: "Шинэ нэр",
            phone: "99001122",
            description: "Манай салон",
          });
          assert.deepEqual(saved, {
            name: "Шинэ нэр",
            phone: "99001122",
            description: "Манай салон",
            slug: "salon-a",
          });
          await assert.rejects(
            updateSalonDetails(db, actors.manager, {
              name: "Манагерын нэр",
              phone: "99001122",
            }),
            denied(403),
          );
          await assert.rejects(
            updateSalonDetails(db, actors.owner, {
              name: " ",
              phone: "99001122",
            }),
          );
          await assert.rejects(
            updateSalonDetails(db, actors.owner, {
              name: "Нэр",
              phone: "99001122",
              slug: "x-salon",
            }),
          );
          const b = await db.salon.findUniqueOrThrow({ where: { id: "b" } });
          assert.equal(b.name, "Өөр салон");
        },
      );
      await t.test(
        "moving the link needs confirmation and a free address",
        async () => {
          await assert.rejects(
            changeSalonSlug(db, actors.owner, { slug: "shine-salon" }),
          );
          await assert.rejects(
            changeSalonSlug(db, actors.owner, {
              slug: "salon-b",
              confirm: true,
            }),
            denied(409),
          );
          await assert.rejects(
            changeSalonSlug(db, actors.owner, {
              slug: "platform",
              confirm: true,
            }),
          );
          await assert.rejects(
            changeSalonSlug(db, actors.manager, {
              slug: "shine-salon",
              confirm: true,
            }),
            denied(403),
          );
          assert.deepEqual(
            await changeSalonSlug(db, actors.owner, {
              slug: "shine-salon",
              confirm: true,
            }),
            { slug: "shine-salon" },
          );
          assert.equal(
            await db.salon.count({ where: { slug: "salon-a" } }),
            0,
            "the old link no longer resolves",
          );
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
