import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { listDirectory } from "../../lib/services/directory";
// What the redesigned /home shows: ratings, a taste of the menu, opening
// hours, category and district counts, and the quick filters.
test("directory cards for the home page", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55521),
    { db } = fixture;
  try {
    await seed(db);
    await bookingSeed(db);
    await db.salon.updateMany({
      data: { coverUrl: "https://example.test/cover.webp" },
    });
    const card = async (slug: string, q = {}) =>
      (await listDirectory(db, q)).salons.find((s) => s.slug === slug);
    const slugs = async (q = {}) =>
      (await listDirectory(db, q)).salons.map((s) => s.slug).sort();
    await t.test("published reviews make the rating", async () => {
      assert.equal((await card("salon-a"))?.rating, null);
      await db.customer.create({
        data: {
          id: "dh-a",
          salonId: "a",
          name: "Сараа",
          phone: "+97688110000",
        },
      });
      let n = 0;
      const review = async (rating: number, hidden = false) => {
        // One past visit each, a few hours apart so they never overlap.
        const startAt = new Date(Date.now() - 86400000 - n++ * 3 * 3600000);
        const booking = await db.booking.create({
          data: {
            salonId: "a",
            branchId: "z",
            customerId: "dh-a",
            serviceId: "book-service-a-60",
            staffId: "book-staff-a-1",
            startAt,
            endAt: new Date(+startAt + 3600000),
            status: "COMPLETED",
            source: "OWNER",
            serviceNameSnapshot: "Хумс арчилгаа",
            durationMinutesSnapshot: 60,
            priceSnapshot: 65000,
            customerNameSnapshot: "Сараа",
            customerPhoneSnapshot: "+97688110000",
            idempotencyKey: randomUUID(),
            requestHash: randomUUID(),
          },
        });
        await db.review.create({
          data: {
            salonId: "a",
            bookingId: booking.id,
            rating,
            customerName: "Сараа",
            hidden,
          },
        });
      };
      await review(5);
      await review(4);
      // A hidden review does not count.
      await review(1, true);
      assert.deepEqual((await card("salon-a"))?.rating, {
        average: 4.5,
        count: 2,
      });
    });
    await t.test("two lowest-priced services and today's hours", async () => {
      const a = (await card("salon-a"))!;
      assert.ok(a.top.length > 0 && a.top.length <= 2);
      assert.ok(
        a.top.every(
          (v, i, all) => i === 0 || all[i - 1].priceMnt <= v.priceMnt,
        ),
      );
      assert.match(a.hours, /^\d{2}:\d{2}–\d{2}:\d{2}$/);
    });
    await t.test("category and district counts", async () => {
      const d = await listDirectory(db, {});
      assert.ok(d.categories.length > 0);
      assert.ok(d.categories.every((c) => c.salons >= 1));
      assert.ok(d.areas.some((a) => a.name === "Хан-Уул" && a.salons === 2));
    });
    await t.test("discount and new filters", async () => {
      await db.service.updateMany({
        where: { salonId: "b" },
        data: { discountPercent: 20 },
      });
      assert.deepEqual(await slugs({ filter: "discount" }), ["salon-b"]);
      await db.salon.update({
        where: { id: "a" },
        data: { createdAt: new Date(Date.now() - 60 * 86400000) },
      });
      assert.deepEqual(await slugs({ filter: "new" }), ["salon-b"]);
      assert.deepEqual(await slugs(), ["salon-a", "salon-b"]);
      // The discounted price is what the card shows; the list price is struck.
      const b = (await card("salon-b"))!;
      assert.ok(b.top.every((v) => v.priceMnt < v.listPriceMnt));
    });
  } finally {
    await fixture.close();
  }
});
