import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  bookingView,
  changeBooking,
  createBooking,
  readBooking,
} from "../../lib/services/bookings";
import { revenueReport } from "../../lib/services/reports";
import { createDeskVisit } from "../../lib/services/visits";
import { deleteCustomer, listCustomers } from "../../lib/services/customers";
import { HttpError } from "../../lib/errors";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("desk extras and payment method", { timeout: 120000 }, async () => {
  const fixture = await testDatabase(55475),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = addDays(localStamp(new Date()).slice(0, 10), 2),
      time = (v: string) => localInstant(`${date}T${v}`).toISOString();
    const input = (start: string, extra: object) => ({
      branchId: "z",
      serviceId: "book-service-a-90",
      staffId: "book-staff-a-1",
      startAt: time(start),
      customer: { name: "Номин", phone: "99112233" },
      idempotencyKey: randomUUID(),
      ...extra,
    });
    const desk = await createBooking(
      db,
      { actor: actors.reception },
      input("10:00", { extraMnt: 15000, paymentMethod: "CASH" }),
    );
    assert.equal(desk.priceSnapshot, 65000);
    assert.equal(desk.extraMnt, 15000);
    assert.equal(desk.paymentMethod, "CASH");
    const view = bookingView(desk);
    assert.equal(view.priceMnt, 80000);
    assert.equal(view.servicePriceMnt, 65000);
    // Guests cannot add charges or claim a payment.
    const online = await createBooking(
      db,
      { slug: "salon-a" },
      input("14:00", { extraMnt: 99000, paymentMethod: "POS" }),
    );
    assert.equal(online.extraMnt, 0);
    assert.equal(online.paymentMethod, null);
    await assert.rejects(
      createBooking(
        db,
        { actor: actors.reception },
        input("16:00", { extraMnt: -1 }),
      ),
    );
    // Revenue counts what the customer paid, extras included.
    await changeBooking(db, actors.reception, desk.id, {
      action: "status",
      status: "COMPLETED",
      version: desk.version,
    });
    const report = await revenueReport(db, actors.owner, {
      from: date,
      to: date,
    });
    assert.equal(report.revenue, 80000);
    // Two services at once: two staff, one group, the extra counted once.
    const visit = await createDeskVisit(db, actors.reception, {
      branchId: "z",
      items: [
        { serviceId: "book-service-a-90", staffId: "book-staff-a-2" },
        { serviceId: "book-service-a-60" },
      ],
      startAt: time("16:00"),
      customer: { name: "Хос", phone: "99112244" },
      extraMnt: 10000,
      paymentMethod: "POS",
      idempotencyKey: randomUUID(),
    });
    assert.equal(visit.length, 2);
    assert.notEqual(visit[0].staffId, visit[1].staffId);
    assert.equal(visit[0].staffId, "book-staff-a-2");
    assert.ok(visit[0].groupId && visit[0].groupId === visit[1].groupId);
    assert.deepEqual(
      visit.map((b) => b.extraMnt),
      [10000, 0],
    );
    assert.ok(visit.every((b) => +b.startAt === +new Date(time("16:00"))));
    assert.ok(visit.every((b) => b.status === "CONFIRMED"));
    // Paying later: the method goes to the whole visit, the extra stays put.
    const paid = await changeBooking(db, actors.reception, visit[0].id, {
      action: "payment",
      paymentMethod: "TRANSFER",
      extraMnt: 20000,
      version: visit[0].version,
    });
    assert.equal(paid.extraMnt, 20000);
    const sibling = await db.booking.findUniqueOrThrow({
      where: { id: visit[1].id },
    });
    assert.equal(sibling.paymentMethod, "TRANSFER");
    assert.equal(sibling.extraMnt, 0);
    const cleared = await changeBooking(db, actors.reception, paid.id, {
      action: "payment",
      paymentMethod: null,
      version: paid.version,
    });
    assert.equal(cleared.paymentMethod, null);
    assert.equal(cleared.extraMnt, 20000);
    // Staff cancellations name who did it.
    const gone = await changeBooking(db, actors.reception, visit[1].id, {
      action: "status",
      status: "CANCELLED",
      version: (
        await db.booking.findUniqueOrThrow({ where: { id: visit[1].id } })
      ).version,
    });
    assert.equal(gone.cancelSource, "STAFF");
    assert.equal(gone.cancelledByMemberId, actors.reception.id);
    const shown = await readBooking(db, actors.owner, gone.id);
    assert.equal(shown.status, "CANCELLED");
    assert.equal(shown.cancelSource, "STAFF");
    assert.ok(shown.cancelledByName);
    assert.ok(shown.cancelledAt);
    // The customer list shows visits and spending; cancelled ones do not count.
    const list = await listCustomers(db, actors.owner);
    const nomin = list.customers.find((c) => c.phone === "+97699112233")!;
    assert.equal(nomin.visits, 2);
    assert.equal(nomin.spentMnt, 65000 + 15000 + 65000);
    assert.ok(nomin.lastService);
    // Deleting: owner only, never someone with an upcoming booking.
    await assert.rejects(
      deleteCustomer(db, actors.reception, nomin.id),
      (e: unknown) => e instanceof HttpError && e.status === 403,
    );
    await assert.rejects(
      deleteCustomer(db, actors.owner, nomin.id),
      (e: unknown) => e instanceof HttpError && e.status === 409,
    );
    await fixture.settle();
    const junk = await db.customer.create({
      data: { salonId: "a", name: "ner baihgui", phone: "+97699186455" },
    });
    await deleteCustomer(db, actors.owner, junk.id);
    assert.equal(await db.customer.count({ where: { id: junk.id } }), 0);
    await assert.rejects(
      createDeskVisit(db, actors.reception, {
        branchId: "z",
        items: [
          { serviceId: "book-service-a-90", staffId: "book-staff-a-1" },
          { serviceId: "book-service-a-60", staffId: "book-staff-a-1" },
        ],
        startAt: time("16:00"),
        customer: { name: "Хос", phone: "99112244" },
        idempotencyKey: randomUUID(),
      }),
    );
    await assert.rejects(
      createDeskVisit(db, actors.staff, {
        branchId: "z",
        items: [{ serviceId: "book-service-a-60" }],
        startAt: time("16:00"),
        customer: { name: "Хос", phone: "99112244" },
        idempotencyKey: randomUUID(),
      }),
      (e: unknown) => e instanceof HttpError && e.status === 403,
    );
    await fixture.settle();
  } finally {
    await fixture.close();
  }
});
