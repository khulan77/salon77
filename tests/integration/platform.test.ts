import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createBooking, publicCatalog } from "../../lib/services/bookings";
import { createVisit } from "../../lib/services/visits";
import {
  listPlatformSalons,
  platformOverview,
  platformSalonDetail,
  setSalonStatus,
} from "../../lib/services/platform";
import { refreshActor } from "../../lib/access";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("platform console", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55490),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000009";
    await db.user.create({
      data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
    });
    const date = addDays(localStamp(new Date()).slice(0, 10), 3);
    const at = (time: string) => localInstant(`${date}T${time}`).toISOString();
    for (const [time, phone] of [
      ["10:00", "88112233"],
      ["12:00", "88112244"],
    ])
      await createVisit(db, "salon-a", {
        branchId: "z",
        items: [{ serviceId: "book-service-a-60" }],
        startAt: at(time),
        customer: { name: "Нууц Үйлчлүүлэгч", phone },
        idempotencyKey: randomUUID(),
      });
    await createBooking(
      db,
      { actor: actors.reception },
      {
        branchId: "z",
        serviceId: "book-service-a-60",
        staffId: "book-staff-a-2",
        startAt: at("15:00"),
        customer: { name: "Нууц Үйлчлүүлэгч", phone: "88112255" },
        idempotencyKey: randomUUID(),
      },
    );
    await t.test("everyone except a super admin gets 404", async () => {
      for (const userId of [
        userIds.owner,
        userIds.other,
        userIds.reception,
        randomUUID(),
      ]) {
        await assert.rejects(platformOverview(db, userId), status(404));
        await assert.rejects(listPlatformSalons(db, userId, {}), status(404));
        await assert.rejects(platformSalonDetail(db, userId, "a"), status(404));
        await assert.rejects(
          setSalonStatus(db, userId, "a", { status: "SUSPENDED" }),
          status(404),
        );
      }
      assert.equal(
        (await db.salon.findUniqueOrThrow({ where: { id: "a" } })).status,
        "ACTIVE",
      );
    });
    await t.test("overview and salon list count real usage", async () => {
      const o = await platformOverview(db, admin);
      assert.deepEqual(o.salons, {
        total: 2,
        active: 2,
        suspended: 0,
        new7: 2,
        new30: 2,
      });
      assert.equal(o.branches, 3);
      assert.deepEqual(o.onlineBookings, { today: 2, days7: 2, days30: 2 });
      assert.equal(o.bookings30, 3);
      assert.equal(o.daily.length, 30);
      assert.equal(o.daily.at(-1)?.count, 2);
      const list = await listPlatformSalons(db, admin, { sort: "bookings" });
      assert.equal(list.total, 2);
      const a = list.salons[0];
      assert.equal(a.id, "a");
      assert.equal(a.ownerEmail, "owner@example.test");
      assert.equal(a.branches, 2);
      assert.equal(a.staff, 2);
      assert.equal(a.online30, 2);
      assert.equal(a.bookings, 3);
      assert.ok(a.lastBookingAt);
      assert.equal(o.weekly.length, 12);
      assert.equal(o.weekly.at(-1)?.count, 2);
      assert.ok(o.weekly.slice(0, -1).every((w) => w.count === 0));
      // Activity = newest booking or member login; salon a has bookings.
      let byActivity = await listPlatformSalons(db, admin, {
        sort: "activity",
      });
      assert.deepEqual(
        byActivity.salons.map((s) => s.id),
        ["a", "b"],
      );
      await db.user.update({
        where: { id: userIds.other },
        data: { lastLoginAt: new Date(Date.now() + 60000) },
      });
      byActivity = await listPlatformSalons(db, admin, { sort: "activity" });
      assert.deepEqual(
        byActivity.salons.map((s) => s.id),
        ["b", "a"],
      );
      assert.equal(byActivity.salons[1].online30, 2);
      const filtered = await listPlatformSalons(db, admin, {
        sort: "activity",
        query: "туршилт",
      });
      assert.deepEqual(
        filtered.salons.map((s) => s.id),
        ["a"],
      );
      // LIKE wildcards in the search box are literal.
      assert.equal(
        (await listPlatformSalons(db, admin, { sort: "activity", query: "%" }))
          .salons.length,
        0,
      );
      const found = await listPlatformSalons(db, admin, { query: "өөр" });
      assert.deepEqual(
        found.salons.map((s) => s.id),
        ["b"],
      );
      await assert.rejects(listPlatformSalons(db, admin, { sort: "secret" }));
    });
    await t.test("salon detail shows aggregates, never customers", async () => {
      const d = await platformSalonDetail(db, admin, "a");
      assert.equal(d.bySource.ONLINE, 2);
      assert.equal(d.bySource.RECEPTION, 1);
      assert.equal(d.byStatus.PENDING, 2);
      assert.ok(d.members.some((m) => m.role === "RECEPTIONIST"));
      const json = JSON.stringify([d, await listPlatformSalons(db, admin, {})]);
      for (const secret of ["Нууц Үйлчлүүлэгч", "88112233", "+97688112233"])
        assert.ok(!json.includes(secret), secret);
      await assert.rejects(
        platformSalonDetail(db, admin, "missing"),
        status(404),
      );
    });
    await t.test(
      "suspending blocks the salon everywhere and is audited",
      async () => {
        await setSalonStatus(db, admin, "a", { status: "SUSPENDED" });
        await assert.rejects(refreshActor(db, actors.owner), status(403));
        await assert.rejects(publicCatalog(db, "salon-a"), status(404));
        assert.equal((await platformOverview(db, admin)).salons.suspended, 1);
        await setSalonStatus(db, admin, "a", { status: "ACTIVE" });
        await refreshActor(db, actors.owner);
        await publicCatalog(db, "salon-a");
        const audit = await db.platformAuditLog.findMany({
          orderBy: { createdAt: "asc" },
        });
        assert.deepEqual(
          audit.map((a) => a.action),
          ["SUSPEND_SALON", "ACTIVATE_SALON"],
        );
        assert.ok(
          audit.every((a) => a.actorUserId === admin && a.salonId === "a"),
        );
        await assert.rejects(
          setSalonStatus(db, admin, "a", { status: "DELETED" }),
        );
      },
    );
  } finally {
    await fixture.close();
  }
});
