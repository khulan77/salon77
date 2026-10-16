import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking } from "../../lib/services/bookings";
import { createVisit } from "../../lib/services/visits";
import { deleteSalon } from "../../lib/services/platform";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "the platform deletes a salon for good",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55522),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const admin = "00000000-0000-0000-0000-000000000009";
      await db.user.create({
        data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
      });
      // History that a plain cascade would refuse to remove.
      const date = addDays(localStamp(new Date()).slice(0, 10), 3);
      const at = (time: string) =>
        localInstant(`${date}T${time}`).toISOString();
      await createVisit(db, "salon-a", {
        branchId: "z",
        items: [{ serviceId: "book-service-a-60" }],
        startAt: at("10:00"),
        customer: { name: "Сараа", phone: "88112233" },
        idempotencyKey: randomUUID(),
      });
      const desk = await createBooking(
        db,
        { actor: actors.reception },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-2",
          startAt: at("15:00"),
          customer: { name: "Номин", phone: "88112244" },
          idempotencyKey: randomUUID(),
        },
      );
      await db.review.create({
        data: {
          salonId: "a",
          bookingId: desk.id,
          rating: 5,
          customerName: "Номин",
        },
      });
      await db.staffAttendance.create({
        data: {
          salonId: "a",
          staffId: "book-staff-a-1",
          date: new Date(`${date}T00:00:00Z`),
          status: "WORKED",
          updatedByMemberId: actors.owner.id,
        },
      });
      await t.test(
        "only the platform admin, only with the exact name",
        async () => {
          for (const userId of [userIds.owner, userIds.other, randomUUID()])
            await assert.rejects(
              deleteSalon(db, userId, "a", { confirmName: "Туршилтын салон" }),
              status(404),
            );
          const salon = await db.salon.findUniqueOrThrow({
            where: { id: "a" },
          });
          await assert.rejects(
            deleteSalon(db, admin, "a", { confirmName: `${salon.name} 2` }),
            status(400),
          );
          await assert.rejects(
            deleteSalon(db, admin, "missing", { confirmName: "x" }),
            status(404),
          );
          assert.ok(await db.salon.findUnique({ where: { id: "a" } }));
        },
      );
      await t.test("removes the salon and everything it owns", async () => {
        const name = (await db.salon.findUniqueOrThrow({ where: { id: "a" } }))
          .name;
        const otherBefore = await db.booking.count({ where: { salonId: "b" } });
        assert.deepEqual(
          await deleteSalon(db, admin, "a", { confirmName: ` ${name} ` }),
          { id: "a", deleted: true },
        );
        const where = { salonId: "a" };
        assert.equal(await db.salon.count({ where: { id: "a" } }), 0);
        for (const count of [
          db.booking.count({ where }),
          db.customer.count({ where }),
          db.review.count({ where }),
          db.staff.count({ where }),
          db.branch.count({ where }),
          db.service.count({ where }),
          db.salonMember.count({ where }),
          db.workingHours.count({ where }),
          db.staffAttendance.count({ where }),
        ])
          assert.equal(await count, 0);
        // People keep their accounts; the other salon is untouched.
        assert.ok(await db.user.findUnique({ where: { id: userIds.owner } }));
        assert.equal(await db.salon.count({ where: { id: "b" } }), 1);
        assert.equal(
          await db.booking.count({ where: { salonId: "b" } }),
          otherBefore,
        );
        // The audit trail outlives the salon and remembers its name.
        const log = await db.platformAuditLog.findFirstOrThrow({
          where: { action: "DELETE_SALON" },
        });
        assert.equal(log.salonId, null);
        assert.equal(log.salonName, name);
        assert.equal(log.actorUserId, admin);
      });
    } finally {
      await fixture.close();
    }
  },
);
