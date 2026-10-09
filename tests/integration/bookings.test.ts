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
  publicCatalog,
  publicReceipt,
  bookingConflict,
} from "../../lib/services/bookings";
import {
  listCustomers,
  customerDetail,
  updateCustomer,
} from "../../lib/services/customers";
import {
  localStamp,
  localInstant,
  addDays,
  dayWindow,
} from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const rejected = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "Phase 3 PostgreSQL booking acceptance and security",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55481),
      { db, pg } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const date = addDays(localStamp(new Date()).slice(0, 10), 2),
        time = (v: string) => localInstant(`${date}T${v}`).toISOString();
      const query = {
        branchId: "z",
        serviceId: "book-service-a-90",
        staffId: "book-staff-a-1",
        date,
      };
      const input = (start = "10:00") => ({
        branchId: query.branchId,
        serviceId: query.serviceId,
        staffId: query.staffId,
        startAt: time(start),
        customer: {
          name: "Номин",
          phone: "99 11-22-33",
          email: "test@example.test",
        },
        idempotencyKey: randomUUID(),
      });
      const available = async () =>
        (await availability(db, { actor: actors.owner }, query)).slots.map(
          (s) => localStamp(s.startAt).slice(11),
        );
      await t.test(
        "availability respects shift, closing, break, duration and 15-minute interval",
        async () => {
          const slots = await available();
          for (const value of ["10:00", "10:15", "11:30", "14:00", "16:30"])
            assert.ok(slots.includes(value), value);
          for (const value of [
            "09:45",
            "11:45",
            "12:00",
            "13:00",
            "13:45",
            "16:45",
            "18:00",
          ])
            assert.ok(!slots.includes(value), value);
          assert.ok(slots.every((s) => Number(s.slice(3)) % 15 === 0));
        },
      );
      await t.test(
        "full-day and partial-day time off are excluded without leaking reasons",
        async () => {
          const window = dayWindow(date);
          const off = await db.timeOff.create({
            data: {
              salonId: "a",
              staffId: query.staffId,
              branchId: "z",
              startsAt: window.start,
              endsAt: window.end,
              fullDay: true,
              reason: "Нууц шалтгаан",
            },
          });
          assert.equal((await available()).length, 0);
          await db.timeOff.update({
            where: { id: off.id },
            data: {
              fullDay: false,
              startsAt: new Date(time("11:00")),
              endsAt: new Date(time("12:00")),
            },
          });
          assert.ok(!(await available()).includes("10:00"));
          assert.ok((await available()).includes("14:00"));
          await db.timeOff.delete({ where: { id: off.id } });
        },
      );
      let booking: Awaited<ReturnType<typeof createBooking>>;
      await t.test(
        "manual creation snapshots authoritative values and normalizes customer phone",
        async () => {
          booking = await createBooking(
            db,
            { actor: actors.reception },
            input("15:00"),
          );
          assert.equal(booking.source, "RECEPTION");
          assert.equal(booking.durationMinutesSnapshot, 90);
          assert.equal(booking.priceSnapshot, 65000);
          assert.equal(booking.serviceNameSnapshot, "Гел маникюр");
          assert.equal(booking.customerPhoneSnapshot, "+97699112233");
          assert.equal(booking.endAt.toISOString(), time("16:30"));
          const calendar = await listBookings(db, actors.reception, {
            date,
            days: 1,
          });
          assert.equal(calendar[0].id, booking.id);
          assert.ok(!(await available()).includes("14:00"));
          assert.ok((await available()).includes("16:30"));
          await assert.rejects(
            createBooking(db, { actor: actors.owner }, input("15:00")),
            rejected(409),
          );
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.owner },
              {
                ...input("14:00"),
                serviceId: "book-service-a-60",
                startAt: time("14:30"),
              },
            ),
            rejected(409),
          );
        },
      );
      await t.test(
        "cross-tenant and unauthorized branches reject read/create/status/reschedule and customer IDs",
        async () => {
          await assert.rejects(
            readBooking(db, actors.other, booking.id),
            rejected(404),
          );
          await assert.rejects(
            changeBooking(db, actors.other, booking.id, {
              action: "status",
              status: "CANCELLED",
              version: 1,
            }),
            rejected(404),
          );
          await assert.rejects(
            changeBooking(db, actors.other, booking.id, {
              action: "reschedule",
              startAt: time("10:00"),
              version: 1,
            }),
            rejected(404),
          );
          await assert.rejects(
            createBooking(db, { actor: actors.other }, input()),
            rejected(404),
          );
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.reception },
              { ...input(), branchId: "y" },
            ),
            rejected(403),
          );
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.owner },
              { ...input(), serviceId: "book-service-b-90" },
            ),
            rejected(404),
          );
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.owner },
              { ...input(), staffId: "book-staff-b-1" },
            ),
            rejected(404),
          );
          await assert.rejects(
            availability(
              db,
              { actor: actors.reception },
              { ...query, branchId: "y" },
            ),
            rejected(403),
          );
          await assert.rejects(
            customerDetail(db, actors.other, booking.customerId),
            rejected(404),
          );
          await assert.rejects(
            readBooking(db, actors.staff, booking.id),
            rejected(403),
          );
          assert.equal((await listCustomers(db, actors.other, "")).total, 0);
        },
      );
      await t.test(
        "reschedule ignores itself, keeps snapshots and atomically releases old slot",
        async () => {
          const occupied = await createBooking(
            db,
            { actor: actors.owner },
            { ...input("10:00"), staffId: "book-staff-a-2" },
          );
          await assert.rejects(
            changeBooking(db, actors.reception, booking.id, {
              action: "reschedule",
              staffId: "book-staff-a-2",
              startAt: time("10:30"),
              version: booking.version,
            }),
            rejected(409),
          );
          assert.equal(
            (await readBooking(db, actors.owner, booking.id)).startAt,
            time("15:00"),
          );
          await changeBooking(db, actors.owner, occupied.id, {
            action: "status",
            status: "CANCELLED",
            version: occupied.version,
          });
          const oldId = booking.id;
          const self = await availability(
            db,
            { actor: actors.owner },
            { ...query, excludeBookingId: oldId },
          );
          assert.ok(self.slots.some((s) => s.startAt === time("15:00")));
          await db.service.update({
            where: { id: query.serviceId },
            data: { name: "Шинэ нэр", priceMnt: 99000, durationMinutes: 60 },
          });
          booking = await changeBooking(db, actors.reception, oldId, {
            action: "reschedule",
            startAt: time("10:00"),
            version: booking.version,
          });
          assert.equal(booking.endAt.toISOString(), time("11:30"));
          assert.equal(booking.priceSnapshot, 65000);
          assert.equal(booking.serviceNameSnapshot, "Гел маникюр");
          assert.ok((await available()).includes("15:00"));
          assert.ok(!(await available()).includes("10:00"));
          await assert.rejects(
            changeBooking(db, actors.owner, oldId, {
              action: "reschedule",
              startAt: time("13:00"),
              version: booking.version,
            }),
            rejected(409),
          );
          await assert.rejects(
            changeBooking(db, actors.owner, oldId, {
              action: "status",
              status: "CANCELLED",
              version: 1,
            }),
            rejected(409),
          );
          await db.service.update({
            where: { id: query.serviceId },
            data: { name: "Гел маникюр", priceMnt: 65000, durationMinutes: 90 },
          });
        },
      );
      await t.test(
        "completion preserves occupied history and customer CRM shows booking",
        async () => {
          booking = await changeBooking(db, actors.reception, booking.id, {
            action: "status",
            status: "COMPLETED",
            version: booking.version,
          });
          assert.ok(!(await available()).includes("10:00"));
          const detail = await customerDetail(
            db,
            actors.reception,
            booking.customerId,
          );
          assert.equal(
            detail.history.find((b) => b.id === booking.id)?.status,
            "COMPLETED",
          );
          assert.equal(
            (await listCustomers(db, actors.reception, "9911")).total,
            1,
          );
          await assert.rejects(
            changeBooking(db, actors.owner, booking.id, {
              action: "status",
              status: "CANCELLED",
              version: booking.version,
            }),
            rejected(409),
          );
          await updateCustomer(db, actors.owner, booking.customerId, {
            name: "Шинэ нэр",
            phone: "99112233",
            email: "changed@example.test",
            notes: "Нууц тэмдэглэл",
          });
          assert.equal(
            (await readBooking(db, actors.owner, booking.id)).customerName,
            "Номин",
          );
          assert.equal(
            (await customerDetail(db, actors.reception, booking.customerId))
              .customer.notes,
            "",
          );
        },
      );
      await t.test(
        "online guest shares engine, safe public receipt, idempotent retry and deterministic any-staff",
        async () => {
          const data = {
            ...input("10:00"),
            staffId: undefined,
            customer: { name: "Зочин", phone: "88112233" },
          };
          const online = await createBooking(db, { slug: "salon-a" }, data);
          assert.equal(online.staffId, "book-staff-a-2");
          assert.equal(online.status, "PENDING");
          assert.equal(online.source, "ONLINE");
          const repeat = await createBooking(db, { slug: "salon-a" }, data);
          assert.equal(repeat.id, online.id);
          await assert.rejects(
            createBooking(
              db,
              { slug: "salon-a" },
              { ...data, customer: { name: "Өөр хүн", phone: "88112233" } },
            ),
            rejected(409),
          );
          const receipt = await publicReceipt(db, online);
          assert.equal("customerPhone" in receipt, false);
          assert.equal("notes" in receipt, false);
          assert.equal("idempotencyKey" in receipt, false);
          const catalog = await publicCatalog(db, "salon-a");
          assert.ok(!JSON.stringify(catalog).includes("Хувийн мэдээлэл"));
          // Salon and branch phones are public; staff phones and bios are not.
          assert.ok(
            catalog.staff.every((s) => !("phone" in s) && !("bio" in s)),
          );
          assert.ok(!JSON.stringify(catalog.staff).includes("99112233"));
          const confirmed = await changeBooking(db, actors.owner, online.id, {
            action: "status",
            status: "CONFIRMED",
            version: 1,
          });
          await changeBooking(db, actors.owner, online.id, {
            action: "status",
            status: "NO_SHOW",
            version: confirmed.version,
          });
          await assert.rejects(
            availability(
              db,
              { slug: "salon-a" },
              { ...query, excludeBookingId: booking.id },
            ),
            rejected(403),
          );
        },
      );
      await t.test(
        "cancellation frees the slot and cannot be restored or completed",
        async () => {
          const b = await createBooking(
            db,
            { actor: actors.owner },
            input("14:00"),
          );
          const cancelled = await changeBooking(db, actors.reception, b.id, {
            action: "status",
            status: "CANCELLED",
            version: 1,
          });
          assert.ok((await available()).includes("14:00"));
          await assert.rejects(
            changeBooking(db, actors.owner, b.id, {
              action: "status",
              status: "COMPLETED",
              version: cancelled.version,
            }),
            rejected(409),
          );
          assert.ok(await db.booking.findUnique({ where: { id: b.id } }));
        },
      );
      await t.test(
        "staff can shorten an appointment; online guests cannot override duration",
        async () => {
          const short = await createBooking(
            db,
            { actor: actors.reception },
            { ...input("16:00"), durationMinutes: 30 },
          );
          assert.equal(short.durationMinutesSnapshot, 30);
          assert.equal(+short.endAt - +short.startAt, 30 * 60000);
          assert.equal(short.priceSnapshot, 65000);
          const slots = (
            await availability(
              db,
              { actor: actors.owner },
              { ...query, durationMinutes: "30" },
            )
          ).slots.map((s) => localStamp(s.startAt).slice(11));
          assert.ok(!slots.includes("16:00"));
          assert.ok(slots.includes("16:30"));
          await assert.rejects(
            availability(
              db,
              { slug: "salon-a" },
              { ...query, durationMinutes: "30" },
            ),
            rejected(403),
          );
          await assert.rejects(
            createBooking(
              db,
              { slug: "salon-a" },
              {
                ...input("17:00"),
                staffId: undefined,
                customer: { name: "Зочин", phone: "88112244" },
                durationMinutes: 30,
              },
            ),
            rejected(403),
          );
          await changeBooking(db, actors.owner, short.id, {
            action: "status",
            status: "CANCELLED",
            version: 1,
          });
        },
      );
      await t.test(
        "invalid eligibility, service visibility and past/off-grid requests fail closed",
        async () => {
          await assert.rejects(
            createBooking(db, { actor: actors.owner }, input("14:01")),
            rejected(409),
          );
          await assert.rejects(
            createBooking(
              db,
              { actor: actors.owner },
              { ...input(), startAt: "2020-01-01T02:00:00Z" },
            ),
            rejected(409),
          );
          await db.service.update({
            where: { id: query.serviceId },
            data: { onlineBookable: false },
          });
          await assert.rejects(
            availability(db, { slug: "salon-a" }, query),
            rejected(404),
          );
          await db.service.update({
            where: { id: query.serviceId },
            data: { onlineBookable: true },
          });
          await db.staffService.delete({
            where: {
              staffId_serviceId: {
                staffId: query.staffId,
                serviceId: query.serviceId,
              },
            },
          });
          await assert.rejects(
            availability(db, { actor: actors.owner }, query),
            rejected(404),
          );
          await db.staffService.create({
            data: {
              staffId: query.staffId,
              serviceId: query.serviceId,
              salonId: "a",
            },
          });
        },
      );
      await t.test(
        "database rejects cross-tenant foreign keys and raw overlapping insert independent of engine",
        async () => {
          await assert.rejects(
            pg.exec(
              `UPDATE "Booking" SET "customerId"='missing' WHERE id='${booking.id}'`,
            ),
            /foreign key/,
          );
          await assert.rejects(
            pg.exec(
              `UPDATE "Booking" SET "serviceId"='book-service-b-90' WHERE id='${booking.id}'`,
            ),
            /foreign key/,
          );
          await assert.rejects(
            pg.exec(
              `INSERT INTO "Booking" SELECT 'raw-overlap',"salonId","branchId","customerId","serviceId","staffId","startAt","endAt",status,source,"serviceNameSnapshot","durationMinutesSnapshot","priceSnapshot","customerNameSnapshot","customerPhoneSnapshot",notes,"createdByMemberId",'raw-key','hash',version,"createdAt","updatedAt" FROM "Booking" WHERE id='${booking.id}'`,
            ),
            /exclusion constraint/,
          );
        },
      );
      await t.test(
        "browser database roles cannot access booking or customer records",
        async () => {
          for (const role of ["anon", "authenticated"]) {
            await pg.exec(`SET ROLE ${role}`);
            try {
              for (const table of ["Booking", "Customer"])
                await assert.rejects(
                  pg.exec(`SELECT * FROM "${table}"`),
                  /permission denied/,
                );
            } finally {
              await pg.exec("RESET ROLE");
            }
          }
        },
      );
      assert.equal(
        bookingConflict,
        "Сонгосон цаг саяхан захиалагдсан байна. Өөр цаг сонгоно уу.",
      );
    } finally {
      await fixture.close();
    }
  },
);
