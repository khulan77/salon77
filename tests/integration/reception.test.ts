import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  availability,
  createBooking,
  changeBooking,
  readBooking,
  listBookings,
  peekOptions,
} from "../../lib/services/bookings";
import { listCustomers, customerDetail } from "../../lib/services/customers";
import { revenueReport, monthToDate } from "../../lib/services/reports";
import { moduleAllowed } from "../../lib/access";
import { saveStaff, readStaff } from "../../lib/services/staff";
import { saveService, readCatalog } from "../../lib/services/catalog";
import { setPhoto } from "../../lib/services/salon-media";
import { localStamp, localInstant, addDays } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const rejected = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "Receptionist: own branch bookings, other branches free times only",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55500),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      // Salon A's second branch, which the receptionist (branch z) does not work at.
      await db.service.create({
        data: {
          id: "y-service",
          salonId: "a",
          categoryId: "book-category-a",
          name: "Үс засалт",
          durationMinutes: 60,
          priceMnt: 40000,
          branches: { create: { branchId: "y" } },
        },
      });
      await db.staff.create({
        data: {
          id: "y-staff",
          salonId: "a",
          name: "Сувд",
          title: "Үсчин",
          phone: "99112244",
          branches: { create: { branchId: "y" } },
          services: { create: { serviceId: "y-service" } },
        },
      });
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++)
        await db.workingHours.create({
          data: {
            salonId: "a",
            staffId: "y-staff",
            branchId: "y",
            dayOfWeek,
            startMinute: 600,
            endMinute: 1080,
          },
        });
      const reception = actors.reception;
      const date = addDays(localStamp(new Date()).slice(0, 10), 2),
        time = (v: string) => localInstant(`${date}T${v}`).toISOString();
      const other = { branchId: "y", serviceId: "y-service", date };
      const booking = (branchId: string, serviceId: string, start: string) => ({
        branchId,
        serviceId,
        startAt: time(start),
        customer: { name: "Номин", phone: "99887766" },
        idempotencyKey: randomUUID(),
      });
      await t.test("sees free times of another branch", async () => {
        const result = await availability(db, { actor: reception }, other);
        assert.ok(result.slots.length > 0);
        assert.deepEqual(Object.keys(result.slots[0]), ["startAt"]);
        const options = await peekOptions(db, reception);
        assert.deepEqual(
          options.branches.map((b) => b.id),
          ["y"],
        );
        assert.deepEqual(
          options.services.map((s) => s.id),
          ["y-service"],
        );
        assert.ok(!("priceMnt" in options.services[0]));
        assert.deepEqual(await peekOptions(db, actors.owner), {
          branches: [],
          services: [],
        });
      });
      await t.test(
        "cannot book or change bookings at another branch",
        async () => {
          await assert.rejects(
            createBooking(
              db,
              { actor: reception },
              booking("y", "y-service", "11:00"),
            ),
            rejected(403),
          );
          await assert.rejects(
            availability(
              db,
              { actor: reception },
              { ...other, durationMinutes: 90 },
            ),
            rejected(403),
          );
          const there = await createBooking(
            db,
            { actor: actors.owner },
            booking("y", "y-service", "12:00"),
          );
          await assert.rejects(
            readBooking(db, reception, there.id),
            rejected(404),
          );
          await assert.rejects(
            changeBooking(db, reception, there.id, {
              action: "status",
              status: "CANCELLED",
              version: there.version,
            }),
            rejected(404),
          );
          await assert.rejects(
            listBookings(db, reception, { date, days: 1, branchId: "y" }),
            rejected(403),
          );
          // The customer booked only at branch y stays hidden.
          await assert.rejects(
            customerDetail(db, reception, there.customerId),
            rejected(404),
          );
          assert.equal((await listCustomers(db, reception)).total, 0);
        },
      );
      await t.test(
        "books, changes and cancels at their own branch",
        async () => {
          const own = await createBooking(
            db,
            { actor: reception },
            booking("z", "book-service-a-60", "10:00"),
          );
          assert.equal(own.branchId, "z");
          const moved = await changeBooking(db, reception, own.id, {
            action: "reschedule",
            startAt: time("11:00"),
            version: own.version,
          });
          const cancelled = await changeBooking(db, reception, moved.id, {
            action: "status",
            status: "CANCELLED",
            version: moved.version,
          });
          assert.equal(cancelled.status, "CANCELLED");
          assert.ok(
            (await customerDetail(db, reception, own.customerId)).history
              .length,
          );
        },
      );
      await t.test("adds staff to their own branch only", async () => {
        const person = {
          name: "Цэцгээ",
          title: "Мастер",
          phone: "99001122",
          bio: "",
          active: true,
          memberId: null,
          branchIds: ["z"],
          serviceIds: ["book-service-a-60"],
        };
        const { id } = await saveStaff(db, reception, person);
        const saved = await db.staff.findUniqueOrThrow({
          where: { id },
          include: { branches: true },
        });
        assert.deepEqual(
          saved.branches.map((b) => b.branchId),
          ["z"],
        );
        await assert.rejects(
          saveStaff(db, reception, {
            ...person,
            branchIds: ["y"],
            serviceIds: [],
          }),
          rejected(403),
        );
        await assert.rejects(
          saveStaff(db, reception, { ...person, memberId: "reception" }),
          rejected(403),
        );
        await assert.rejects(
          saveStaff(db, reception, { ...person, active: false }),
          rejected(403),
        );
        // Their own branch's people they edit; shared staff stays admin's.
        await saveStaff(db, reception, { ...person, name: "Өөр нэр" }, id);
        assert.equal(
          (await db.staff.findUniqueOrThrow({ where: { id } })).name,
          "Өөр нэр",
        );
        const listed = (await readStaff(db, reception)).find(
          (s) => s.id === id,
        );
        assert.equal(listed?.phone, person.phone);
        assert.equal(listed?.editable, true);
        await db.staffBranch.create({
          data: { staffId: id, branchId: "y", salonId: "a" },
        });
        assert.equal(
          (await readStaff(db, reception)).find((s) => s.id === id)?.editable,
          false,
        );
        await assert.rejects(
          saveStaff(db, reception, person, id),
          rejected(403),
        );
        await assert.rejects(
          setPhoto(db, reception, "staff", id, new Uint8Array([1]), null),
          rejected(403),
        );
        await assert.rejects(
          setPhoto(db, reception, "branch", "z", new Uint8Array([1]), null),
          rejected(403),
        );
        await assert.rejects(
          saveStaff(db, actors.manager, person),
          rejected(403),
        );
      });
      await t.test("adds and edits services of their own branch", async () => {
        const service = {
          name: "Хөмсөг засалт",
          description: "",
          categoryId: "book-category-a",
          priceMnt: 20000,
          durationMinutes: 30,
          discountPercent: 0,
          onlineBookable: true,
          active: true,
          branchIds: ["z"],
        };
        const { id } = await saveService(db, reception, service);
        await saveService(db, reception, { ...service, priceMnt: 25000 }, id);
        const listed = await readCatalog(db, reception);
        assert.equal(listed.services.find((s) => s.id === id)?.priceMnt, 25000);
        assert.equal(listed.services.find((s) => s.id === id)?.editable, true);
        assert.ok(listed.categories.some((c) => c.id === "book-category-a"));
        // No photo store in tests: passing the branch check reaches 503.
        await assert.rejects(
          setPhoto(db, reception, "service", id, new Uint8Array([1]), null),
          rejected(503),
        );
        await assert.rejects(
          saveService(db, reception, { ...service, branchIds: ["y"] }),
          rejected(403),
        );
        await assert.rejects(
          saveService(db, reception, { ...service, branchIds: ["z", "y"] }),
          rejected(403),
        );
        await assert.rejects(
          saveService(db, reception, { ...service, active: false }, id),
          rejected(403),
        );
        // y-service belongs to the other branch.
        await assert.rejects(
          saveService(
            db,
            reception,
            { ...service, branchIds: ["z"] },
            "y-service",
          ),
          rejected(403),
        );
        await assert.rejects(
          saveService(db, actors.manager, service),
          rejected(403),
        );
      });
      await t.test("other salons stay out of reach", async () => {
        await assert.rejects(
          availability(
            db,
            { actor: reception },
            { branchId: "other", serviceId: "book-service-b-90", date },
          ),
          rejected(404),
        );
      });
      await t.test("reports and admin pages are closed", async () => {
        await assert.rejects(
          revenueReport(db, reception, monthToDate()),
          rejected(403),
        );
        for (const page of [
          "/reports",
          "/settings",
          "/team",
          "/branches",
          "/billing",
        ])
          assert.equal(moduleAllowed("RECEPTIONIST", page), false, page);
        for (const page of [
          "/calendar",
          "/bookings",
          "/customers",
          "/services",
          "/employees",
        ])
          assert.equal(moduleAllowed("RECEPTIONIST", page), true, page);
      });
    } finally {
      await fixture.close();
    }
  },
);
