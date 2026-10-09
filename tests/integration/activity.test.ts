import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { availability, createBooking } from "../../lib/services/bookings";
import { createVisit } from "../../lib/services/visits";
import { changeManagedVisit } from "../../lib/services/manage";
import { markInboxSeen, readInbox } from "../../lib/services/activity";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
test("admin activity feed", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55494),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = addDays(localStamp(new Date()).slice(0, 10), 4);
    const at = (time: string) => localInstant(`${date}T${time}`).toISOString();
    const guest = (time: string, phone: string, two = false) =>
      createVisit(db, "salon-a", {
        branchId: "z",
        items: two
          ? [
              { serviceId: "book-service-a-90" },
              { serviceId: "book-service-a-60" },
            ]
          : [{ serviceId: "book-service-a-60" }],
        startAt: at(time),
        customer: { name: "Зочин", phone },
        idempotencyKey: randomUUID(),
      });
    const types = async () =>
      (
        await db.bookingActivity.findMany({ orderBy: { createdAt: "asc" } })
      ).map((a) => a.type);
    await t.test("each guest action is recorded once per visit", async () => {
      const visit = await guest("10:00", "88110001", true);
      await createBooking(
        db,
        { actor: actors.reception },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-1",
          startAt: at("15:00"),
          customer: { name: "Ресепшн", phone: "99110002" },
          idempotencyKey: randomUUID(),
        },
      );
      assert.deepEqual(await types(), ["ONLINE_CREATED"]);
      await changeManagedVisit(db, "salon-a", {
        action: "reschedule",
        token: visit.manageToken!,
        startAt: at("16:00"),
      });
      await changeManagedVisit(db, "salon-a", {
        action: "cancel",
        token: visit.manageToken!,
      });
      assert.deepEqual(await types(), [
        "ONLINE_CREATED",
        "CUSTOMER_RESCHEDULED",
        "CUSTOMER_CANCELLED",
      ]);
    });
    await t.test("auto-expired bookings appear in the feed", async () => {
      const [held] = await guest("12:00", "88110003");
      await saveBookingSettings(db, actors.owner, {
        ...defaultBookingSettings,
        pendingExpiryMinutes: 60,
      });
      await db.booking.update({
        where: { id: held.id },
        data: { createdAt: new Date(Date.now() - 2 * 3600000) },
      });
      await availability(
        db,
        { slug: "salon-a" },
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          date,
        },
      );
      assert.equal((await types()).filter((x) => x === "EXPIRED").length, 1);
      assert.equal(
        (await db.booking.findUniqueOrThrow({ where: { id: held.id } })).status,
        "CANCELLED",
      );
      await saveBookingSettings(db, actors.owner, defaultBookingSettings);
    });
    await t.test(
      "inbox counts unread and pending, then marks as read",
      async () => {
        await guest("11:00", "88110004");
        let inbox = await readInbox(db, actors.owner);
        // Visit created, moved, cancelled; second guest created then expired; this one.
      assert.equal(inbox.unread, 6);
        assert.equal(inbox.pending, 1);
        assert.equal(inbox.items[0].type, "ONLINE_CREATED");
        assert.equal(inbox.items[0].customerName, "Зочин");
        await markInboxSeen(db, actors.owner);
        inbox = await readInbox(db, actors.owner);
        assert.equal(inbox.unread, 0);
        assert.ok(inbox.items.every((i) => !i.unread));
        // Each member keeps their own read state.
        assert.equal((await readInbox(db, actors.manager)).unread, 6);
      },
    );
    await t.test("branch scope, staff and other salons", async () => {
      // An event in branch y is invisible to reception (assigned to z only).
      const yBooking = await db.booking.create({
        data: {
          salonId: "a",
          branchId: "y",
          customerId: (
            await db.customer.findFirstOrThrow({ where: { salonId: "a" } })
          ).id,
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-2",
          startAt: new Date(at("17:00")),
          endAt: new Date(+new Date(at("17:00")) + 3600000),
          status: "PENDING",
          source: "ONLINE",
          serviceNameSnapshot: "Хумс арчилгаа",
          durationMinutesSnapshot: 60,
          priceSnapshot: 65000,
          customerNameSnapshot: "Яармаг",
          customerPhoneSnapshot: "+97688110005",
          idempotencyKey: randomUUID(),
          requestHash: "x",
        },
      });
      await db.bookingActivity.create({
        data: {
          salonId: "a",
          branchId: "y",
          bookingId: yBooking.id,
          type: "ONLINE_CREATED",
        },
      });
      const reception = await readInbox(db, actors.reception);
      assert.ok(reception.items.every((i) => i.branchName === "Зайсан"));
      assert.equal(reception.pending, 1);
      const manager = await readInbox(db, actors.manager);
      assert.ok(manager.items.some((i) => i.branchName === "Яармаг"));
      assert.equal(manager.pending, 2);
      await assert.rejects(
        readInbox(db, actors.staff),
        (e: unknown) => e instanceof HttpError && e.status === 403,
      );
      const other = await readInbox(db, actors.other);
      assert.deepEqual(
        [other.unread, other.pending, other.items.length],
        [0, 0, 0],
      );
    });
  } finally {
    await fixture.close();
  }
});
