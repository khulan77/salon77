import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking } from "../../lib/services/bookings";
import { removeMember } from "../../lib/services/team";
import { refreshActor } from "../../lib/access";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("an owner removes a team member", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55523),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = addDays(localStamp(new Date()).slice(0, 10), 3);
    // A booking the receptionist made stays after they leave.
    const booking = await createBooking(
      db,
      { actor: actors.reception },
      {
        branchId: "z",
        serviceId: "book-service-a-60",
        staffId: "book-staff-a-2",
        startAt: localInstant(`${date}T15:00`).toISOString(),
        customer: { name: "Номин", phone: "88112244" },
        idempotencyKey: randomUUID(),
      },
    );
    await t.test("only the owner, never the owner themself", async () => {
      await assert.rejects(
        removeMember(db, actors.manager, actors.reception.id),
        status(403),
      );
      await assert.rejects(
        removeMember(db, actors.owner, actors.owner.id),
        status(409),
      );
      // Another salon's owner cannot see this salon's members.
      await assert.rejects(
        removeMember(db, actors.other, actors.reception.id),
        status(404),
      );
    });
    await t.test("access goes; the booking and the account stay", async () => {
      await removeMember(db, actors.owner, actors.reception.id);
      assert.equal(
        await db.salonMember.count({ where: { id: actors.reception.id } }),
        0,
      );
      await assert.rejects(refreshActor(db, actors.reception), status(403));
      const kept = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      assert.equal(kept.createdByMemberId, null);
      assert.ok(await db.user.findUnique({ where: { id: userIds.reception } }));
    });
  } finally {
    await fixture.close();
  }
});
