import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { availability } from "../../lib/services/bookings";
import { createVisit } from "../../lib/services/visits";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import { clientFingerprint, hit } from "../../lib/rate-limit";
import { MAX_ACTIVE_PER_PHONE } from "../../lib/services/guest-guard";
import { localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("client fingerprints are hashed and use the first forwarded address", () => {
  const req = (h: Record<string, string>) =>
    new Request("http://x.test/", { headers: h });
  const a = clientFingerprint(
    req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
  );
  assert.equal(a, clientFingerprint(req({ "x-forwarded-for": "203.0.113.7" })));
  assert.notEqual(
    a,
    clientFingerprint(req({ "x-forwarded-for": "203.0.113.8" })),
  );
  assert.ok(!a.includes("203"));
  assert.match(a, /^[0-9a-f]{32}$/);
});
test("public booking protection", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55488),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = "2030-05-14",
      clock = { now: () => localInstant(`${date}T08:00`) };
    const at = (time: string) => localInstant(`${date}T${time}`).toISOString();
    const visit = (time: string, phone = "88112233", extra = {}) => ({
      branchId: "z",
      items: [{ serviceId: "book-service-a-60" }],
      startAt: at(time),
      customer: { name: "Зочин", phone },
      idempotencyKey: randomUUID(),
      ...extra,
    });
    await t.test(
      "fixed-window limits reject the request after the limit",
      async () => {
        const now = new Date("2030-01-01T00:00:30Z");
        for (let i = 0; i < 3; i++) await hit(db, "test:a", 3, 60, now);
        await assert.rejects(hit(db, "test:a", 3, 60, now), status(429));
        // Other keys and the next window start fresh.
        await hit(db, "test:b", 3, 60, now);
        await hit(db, "test:a", 3, 60, new Date("2030-01-01T00:01:05Z"));
      },
    );
    await t.test(
      "bots that fill the hidden field never create bookings",
      async () => {
        await assert.rejects(
          createVisit(
            db,
            "salon-a",
            visit("10:00", "88112233", { website: "spam.example" }),
            clock,
          ),
          status(400),
        );
        assert.equal(await db.booking.count({ where: { salonId: "a" } }), 0);
      },
    );
    await t.test(
      "one phone can hold only a few upcoming online bookings",
      async () => {
        const times = ["10:00", "11:00", "12:00", "14:00"];
        for (const time of times.slice(0, MAX_ACTIVE_PER_PHONE))
          await createVisit(db, "salon-a", visit(time), clock);
        await assert.rejects(
          createVisit(db, "salon-a", visit("15:00"), clock),
          status(429),
        );
        // A different phone is unaffected; cancelled bookings free the quota.
        await createVisit(db, "salon-a", visit("15:00", "80001111"), clock);
        await db.booking.updateMany({
          where: { salonId: "a", startAt: new Date(at("10:00")) },
          data: { status: "CANCELLED" },
        });
        await createVisit(db, "salon-a", visit("16:00"), clock);
      },
    );
    await t.test(
      "unconfirmed online bookings expire and release their slot",
      async () => {
        await db.booking.deleteMany({ where: { salonId: "a" } });
        const [held] = await createVisit(
          db,
          "salon-a",
          visit("10:00", "81112222"),
          clock,
        );
        assert.equal(held.status, "PENDING");
        const slotsFor = async () =>
          (
            await availability(
              db,
              { slug: "salon-a" },
              {
                branchId: "z",
                serviceId: "book-service-a-60",
                staffId: held.staffId,
                date,
              },
              clock,
            )
          ).slots.map((s) => localStamp(s.startAt).slice(11));
        assert.ok(!(await slotsFor()).includes("10:00"));
        await saveBookingSettings(db, actors.owner, {
          ...defaultBookingSettings,
          pendingExpiryMinutes: 60,
        });
        // Still fresh: nothing expires yet.
        assert.ok(!(await slotsFor()).includes("10:00"));
        await db.booking.update({
          where: { id: held.id },
          data: { createdAt: new Date(Date.now() - 2 * 3600000) },
        });
        assert.ok((await slotsFor()).includes("10:00"));
        const after = await db.booking.findUniqueOrThrow({
          where: { id: held.id },
        });
        assert.equal(after.status, "CANCELLED");
        assert.equal(after.version, held.version + 1);
      },
    );
    await t.test(
      "expiry bounds are enforced by validation and SQL",
      async () => {
        await assert.rejects(
          saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            pendingExpiryMinutes: 10081,
          }),
        );
        await assert.rejects(
          db.bookingSettings.update({
            where: { salonId: "a" },
            data: { pendingExpiryMinutes: -1 },
          }),
        );
      },
    );
  } finally {
    await fixture.close();
  }
});
