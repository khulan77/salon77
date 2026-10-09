import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { saveService, readCatalog } from "../../lib/services/catalog";
import { createBooking, publicCatalog } from "../../lib/services/bookings";
import { localInstant } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
test(
  "service discounts set the authoritative booking price",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55484),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const date = "2030-02-04",
        clock = { now: () => localInstant(`${date}T08:00`) };
      const service = (discountPercent: number) => ({
        name: "Хумс арчилгаа",
        description: "",
        categoryId: "book-category-a",
        priceMnt: 65000,
        durationMinutes: 60,
        discountPercent,
        onlineBookable: true,
        active: true,
        branchIds: ["z"],
      });
      const book = (
        time: string,
        context: Parameters<typeof createBooking>[1],
      ) =>
        createBooking(
          db,
          context,
          {
            branchId: "z",
            serviceId: "book-service-a-60",
            staffId: "book-staff-a-1",
            startAt: localInstant(`${date}T${time}`).toISOString(),
            customer: { name: "Номин", phone: "99112233" },
            idempotencyKey: randomUUID(),
          },
          clock,
        );
      await t.test(
        "owner sets a discount; catalogs expose list and sale price",
        async () => {
          await saveService(db, actors.owner, service(10), "book-service-a-60");
          const admin = await readCatalog(db, actors.owner);
          const row = admin.services.find((s) => s.id === "book-service-a-60")!;
          assert.equal(row.priceMnt, 65000);
          assert.equal(row.discountPercent, 10);
          const pub = await publicCatalog(db, "salon-a");
          const offered = pub.services.find(
            (s) => s.id === "book-service-a-60",
          )!;
          assert.equal(offered.priceMnt, 58500);
          assert.equal(offered.listPriceMnt, 65000);
        },
      );
      await t.test(
        "public and admin bookings snapshot the discounted price",
        async () => {
          const online = await book("10:00", { slug: "salon-a" });
          assert.equal(online.priceSnapshot, 58500);
          assert.equal(online.discountPercentSnapshot, 10);
          const desk = await book("12:00", { actor: actors.owner });
          assert.equal(desk.priceSnapshot, 58500);
        },
      );
      await t.test(
        "changing the discount never rewrites existing bookings",
        async () => {
          await saveService(db, actors.owner, service(0), "book-service-a-60");
          const later = await book("15:00", { slug: "salon-a" });
          assert.equal(later.priceSnapshot, 65000);
          assert.equal(later.discountPercentSnapshot, 0);
          const earlier = await db.booking.findMany({
            where: { salonId: "a", discountPercentSnapshot: 10 },
          });
          assert.equal(earlier.length, 2);
          assert.ok(earlier.every((b) => b.priceSnapshot === 58500));
        },
      );
      await t.test(
        "only owners set discounts and the database bounds them",
        async () => {
          for (const actor of [actors.manager, actors.reception])
            await assert.rejects(
              saveService(db, actor, service(20), "book-service-a-60"),
              (e: unknown) => e instanceof HttpError && e.status === 403,
            );
          await assert.rejects(
            saveService(db, actors.owner, service(95), "book-service-a-60"),
          );
          await assert.rejects(
            db.service.update({
              where: { id: "book-service-a-60" },
              data: { discountPercent: 95 },
            }),
          );
          await fixture.settle();
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
