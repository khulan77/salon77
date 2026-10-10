import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { listDirectory } from "../../lib/services/directory";
test("public salon directory", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55491),
    { db } = fixture;
  try {
    await seed(db);
    await bookingSeed(db);
    const slugs = async (q = {}) =>
      (await listDirectory(db, q)).salons.map((s) => s.slug).sort();
    await t.test("lists bookable salons with public fields only", async () => {
      assert.deepEqual(await slugs(), ["salon-a", "salon-b"]);
      const d = await listDirectory(db, {});
      const a = d.salons.find((s) => s.slug === "salon-a")!;
      assert.equal(a.services, 2);
      assert.equal(a.fromMnt, 65000);
      assert.equal(a.hasDiscount, false);
      assert.deepEqual(Object.keys(a).sort(), [
        "address",
        "branches",
        "categories",
        "coverUrl",
        "description",
        "district",
        "fromMnt",
        "hasDiscount",
        "isNew",
        "name",
        "photos",
        "services",
        "slug",
      ]);
      assert.deepEqual(a.categories, ["Захиалгын ангилал"]);
      assert.equal(a.isNew, true);
      assert.deepEqual(d.stats, { salons: 2, services: 4, bookingsToday: 0 });
      assert.deepEqual(d.popular, ["Захиалгын ангилал"]);
      const json = JSON.stringify(d);
      for (const secret of [
        "99112233",
        "Хувийн мэдээлэл",
        "owner@example.test",
      ])
        assert.ok(!json.includes(secret), secret);
    });
    await t.test("starting price reflects discounts", async () => {
      await db.service.update({
        where: { id: "book-service-a-60" },
        data: { discountPercent: 20 },
      });
      const a = (await listDirectory(db, {})).salons.find(
        (s) => s.slug === "salon-a",
      )!;
      assert.equal(a.fromMnt, 52000);
      assert.equal(a.hasDiscount, true);
    });
    await t.test(
      "search by salon or service name and filter by district",
      async () => {
        assert.deepEqual(await slugs({ query: "туршилт" }), ["salon-a"]);
        assert.deepEqual(await slugs({ query: "гел маникюр" }), [
          "salon-a",
          "salon-b",
        ]);
        await db.branch.update({
          where: { id: "other" },
          data: { district: "Баянгол" },
        });
        const d = await listDirectory(db, { district: "Баянгол" });
        assert.deepEqual(
          d.salons.map((s) => s.slug),
          ["salon-b"],
        );
        assert.ok(
          d.districts.includes("Баянгол") && d.districts.includes("Хан-Уул"),
        );
        // Category names match as well, so the quick filters work.
        assert.deepEqual(await slugs({ query: "захиалгын ангилал" }), [
          "salon-a",
          "salon-b",
        ]);
        assert.deepEqual(await slugs({ query: "байхгүй үйлчилгээ" }), []);
        await assert.rejects(listDirectory(db, { salonId: "a" }));
      },
    );
    await t.test(
      "hidden: suspended, closed, opted out or nothing bookable",
      async () => {
        await db.salon.update({
          where: { id: "a" },
          data: { status: "SUSPENDED" },
        });
        assert.deepEqual(await slugs(), ["salon-b"]);
        await db.salon.update({
          where: { id: "a" },
          data: { status: "ACTIVE" },
        });
        await db.bookingSettings.update({
          where: { salonId: "a" },
          data: { publicBookingEnabled: false },
        });
        assert.deepEqual(await slugs(), ["salon-b"]);
        await db.bookingSettings.update({
          where: { salonId: "a" },
          data: { publicBookingEnabled: true, listedInDirectory: false },
        });
        assert.deepEqual(await slugs(), ["salon-b"]);
        await db.bookingSettings.update({
          where: { salonId: "a" },
          data: { listedInDirectory: true },
        });
        await db.service.updateMany({
          where: { salonId: "b" },
          data: { onlineBookable: false },
        });
        assert.deepEqual(await slugs(), ["salon-a"]);
        assert.ok(!(await listDirectory(db, {})).districts.includes("Баянгол"));
      },
    );
  } finally {
    await fixture.close();
  }
});
