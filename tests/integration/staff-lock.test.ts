import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking, changeBooking } from "../../lib/services/bookings";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const rejected = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "a starred booking stays with its staff member",
  { timeout: 120000 },
  async () => {
    const fixture = await testDatabase(55476),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const date = addDays(localStamp(new Date()).slice(0, 10), 2),
        time = (v: string) => localInstant(`${date}T${v}`).toISOString();
      let booking = await createBooking(
        db,
        { actor: actors.reception },
        {
          branchId: "z",
          serviceId: "book-service-a-90",
          staffId: "book-staff-a-1",
          startAt: time("10:00"),
          customer: { name: "Номин", phone: "99112233" },
          idempotencyKey: randomUUID(),
        },
      );
      assert.equal(booking.staffLocked, false);
      booking = await changeBooking(db, actors.reception, booking.id, {
        action: "lock",
        locked: true,
        version: booking.version,
      });
      assert.equal(booking.staffLocked, true);
      // Another staff member is refused; a new time with the same one is fine.
      await assert.rejects(
        changeBooking(db, actors.reception, booking.id, {
          action: "reschedule",
          staffId: "book-staff-a-2",
          startAt: time("10:00"),
          version: booking.version,
        }),
        rejected(409),
      );
      await fixture.settle();
      booking = await changeBooking(db, actors.reception, booking.id, {
        action: "reschedule",
        staffId: "book-staff-a-1",
        startAt: time("14:00"),
        version: booking.version,
      });
      assert.equal(booking.staffId, "book-staff-a-1");
      // Without the star it moves freely.
      booking = await changeBooking(db, actors.reception, booking.id, {
        action: "lock",
        locked: false,
        version: booking.version,
      });
      booking = await changeBooking(db, actors.reception, booking.id, {
        action: "reschedule",
        staffId: "book-staff-a-2",
        startAt: time("14:00"),
        version: booking.version,
      });
      assert.equal(booking.staffId, "book-staff-a-2");
      // Staff accounts cannot change bookings at all.
      await assert.rejects(
        changeBooking(db, actors.staff, booking.id, {
          action: "lock",
          locked: true,
          version: booking.version,
        }),
        rejected(403),
      );
      await fixture.settle();
    } finally {
      await fixture.close();
    }
  },
);
