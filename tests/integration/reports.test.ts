import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { BookingStatus } from "@prisma/client";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { revenueReport } from "../../lib/services/reports";
import { localInstant } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;
test(
  "revenue reports are tenant and branch scoped",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55483),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      // A salon-A branch outside the manager's assignment.
      await db.branch.create({
        data: {
          id: "x",
          salonId: "a",
          name: "Хаалттай салбар",
          district: "Сүхбаатар",
          address: "Туршилтын хаяг",
          phone: "99112233",
        },
      });
      for (const salonId of ["a", "b"])
        await db.customer.create({
          data: {
            id: `rep-${salonId}`,
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
        staff = 1,
        price = 65000,
      ) => {
        const startAt = localInstant(at);
        return db.booking.create({
          data: {
            salonId,
            branchId,
            customerId: `rep-${salonId}`,
            serviceId: `book-service-${salonId}-60`,
            staffId: `book-staff-${salonId}-${staff}`,
            startAt,
            endAt: new Date(+startAt + 60 * 60000),
            status,
            source: "OWNER",
            serviceNameSnapshot: "Хумс арчилгаа",
            durationMinutesSnapshot: 60,
            priceSnapshot: price,
            customerNameSnapshot: "Сараа",
            customerPhoneSnapshot: "+97688112233",
            idempotencyKey: randomUUID(),
            requestHash: String(n++),
          },
        });
      };
      await book("a", "z", "2030-03-04T10:00", "COMPLETED");
      await book("a", "z", "2030-03-04T12:00", "COMPLETED", 2, 40000);
      await book("a", "x", "2030-03-05T10:00", "COMPLETED", 1, 100000);
      await book("a", "z", "2030-03-06T10:00", "CANCELLED");
      await book("a", "z", "2030-03-06T12:00", "NO_SHOW");
      await book("a", "z", "2030-03-07T10:00", "CONFIRMED");
      await book("a", "z", "2030-04-01T10:00", "COMPLETED");
      await book("b", "other", "2030-03-04T10:00", "COMPLETED", 1, 999000);
      const range = { from: "2030-03-01", to: "2030-03-31" };
      await t.test("owner sees salon-wide completed revenue only", async () => {
        const r = await revenueReport(db, actors.owner, range);
        assert.equal(r.revenue, 205000);
        assert.equal(r.completed, 3);
        assert.equal(r.cancelled, 1);
        assert.equal(r.noShow, 1);
        assert.equal(r.series.length, 31);
        assert.equal(
          r.series.find((b) => b.key === "2030-03-04")?.revenue,
          105000,
        );
        assert.deepEqual(
          r.byStaff.map((s) => [s.name, s.revenue]),
          [
            ["Ану", 165000],
            ["Болор", 40000],
          ],
        );
        const z = await revenueReport(db, actors.owner, {
          ...range,
          branchId: "z",
        });
        assert.equal(z.revenue, 105000);
      });
      await t.test("other tenant never sees salon A revenue", async () => {
        const r = await revenueReport(db, actors.other, range);
        assert.equal(r.revenue, 999000);
        const foreign = await revenueReport(db, actors.other, {
          ...range,
          branchId: "z",
        });
        assert.equal(foreign.revenue, 0);
      });
      await t.test("manager is limited to assigned branches", async () => {
        const r = await revenueReport(db, actors.manager, range);
        assert.equal(r.revenue, 105000);
        await assert.rejects(
          revenueReport(db, actors.manager, { ...range, branchId: "x" }),
          denied(403),
        );
      });
      await t.test("reception and staff cannot read revenue", async () => {
        for (const actor of [actors.reception, actors.staff])
          await assert.rejects(revenueReport(db, actor, range), denied(403));
      });
      await t.test(
        "invalid ranges and injected fields are rejected",
        async () => {
          for (const bad of [
            { from: "2030-03-31", to: "2030-03-01" },
            { ...range, salonId: "b" },
          ])
            await assert.rejects(revenueReport(db, actors.owner, bad));
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
