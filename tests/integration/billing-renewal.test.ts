import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { publicCatalog } from "../../lib/services/bookings";
import { listPlatformSalons } from "../../lib/services/platform";
import {
  chooseRenewal,
  recordPayment,
  salonBilling,
  setPricePerBranch,
  setSalonPrice,
} from "../../lib/services/billing";
import { HttpError } from "../../lib/errors";
const DAY = 86400000;
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test(
  "trial end, owner's choice, manual price and payment",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55511),
      { db } = fixture;
    try {
      await seed(db);
      const actors = await bookingSeed(db);
      const admin = "00000000-0000-0000-0000-000000000019";
      await db.user.create({
        data: { id: admin, email: "ops2@example.test", isSuperAdmin: true },
      });
      const now = new Date();
      // Approved twelve days ago: two free days left.
      await db.salon.update({
        where: { id: "a" },
        data: {
          reviewStatus: "APPROVED",
          trialEndsAt: new Date(+now + 2 * DAY),
          paidUntil: null,
        },
      });
      await t.test("near the trial's end the owner is asked", async () => {
        const billing = await salonBilling(db, "a", now);
        assert.equal(billing.state, "TRIAL");
        assert.equal(billing.daysLeft, 2);
        assert.equal(billing.askChoice, true);
        assert.equal(billing.choice, null);
        // Ten days earlier nobody is asked yet.
        const early = await salonBilling(db, "a", new Date(+now - 10 * DAY));
        assert.equal(early.askChoice, false);
      });
      await t.test("only the owner answers, with a known choice", async () => {
        for (const actor of [actors.manager, actors.reception])
          await assert.rejects(
            chooseRenewal(db, actor, { choice: "STOP" }),
            status(403),
          );
        await assert.rejects(chooseRenewal(db, actors.owner, { choice: "X" }));
        await assert.rejects(
          chooseRenewal(db, actors.owner, { choice: "STOP", salonId: "b" }),
        );
        assert.deepEqual(
          await chooseRenewal(db, actors.owner, { choice: "STOP" }),
          { choice: "STOP" },
        );
        assert.equal((await salonBilling(db, "a", now)).choice, "STOP");
        const b = await db.salon.findUniqueOrThrow({ where: { id: "b" } });
        assert.equal(b.renewalChoice, null);
      });
      await t.test(
        "after the trial the booking page closes, data stays",
        async () => {
          const later = new Date(+now + 3 * DAY);
          const billing = await salonBilling(db, "a", later);
          assert.equal(billing.state, "EXPIRED");
          assert.equal(billing.askChoice, true);
          await db.salon.update({
            where: { id: "a" },
            data: { trialEndsAt: new Date(+now - DAY) },
          });
          await assert.rejects(publicCatalog(db, "salon-a"), status(404));
          assert.ok((await db.service.count({ where: { salonId: "a" } })) > 0);
          assert.ok((await db.staff.count({ where: { salonId: "a" } })) > 0);
        },
      );
      await t.test(
        "the operator sees usage and sets the fee by hand",
        async () => {
          await db.customer.create({
            data: {
              id: "renewal",
              salonId: "a",
              name: "Сараа",
              phone: "+97688112233",
            },
          });
          await db.booking.create({
            data: {
              salonId: "a",
              customerId: "renewal",
              branchId: "z",
              serviceId: "book-service-a-60",
              staffId: "book-staff-a-1",
              startAt: new Date(+now - 2 * 3600000),
              endAt: new Date(+now - 3600000),
              status: "CANCELLED",
              source: "ONLINE",
              serviceNameSnapshot: "Хумс арчилгаа",
              durationMinutesSnapshot: 60,
              priceSnapshot: 65000,
              customerNameSnapshot: "Сараа",
              customerPhoneSnapshot: "+97688112233",
              idempotencyKey: randomUUID(),
              requestHash: "renewal",
            },
          });
          const listed = await listPlatformSalons(db, admin, {});
          const a = listed.salons.find((s) => s.id === "a")!;
          assert.equal(a.onlineMonth, 1);
          assert.equal(a.renewalChoice, "STOP");
          assert.equal(typeof a.services, "number");
          assert.equal(typeof a.staff, "number");
          // No branch price yet: nothing to charge until one is set.
          let billing = await salonBilling(db, "a", now);
          assert.equal(billing.amountMnt, null);
          assert.equal(billing.usage.onlineMonth, 1);
          assert.equal(billing.usage.branches, 2);
          await setPricePerBranch(db, admin, { pricePerBranchMnt: 100000 });
          billing = await salonBilling(db, "a", now);
          assert.equal(billing.amountMnt, 200000);
          assert.equal(billing.customPrice, false);
          await assert.rejects(
            setSalonPrice(db, admin, "a", { monthlyPriceMnt: 150000, x: 1 }),
          );
          await setSalonPrice(db, admin, "a", { monthlyPriceMnt: 150000 });
          billing = await salonBilling(db, "a", now);
          assert.equal(billing.amountMnt, 150000);
          assert.equal(billing.customPrice, true);
        },
      );
      await t.test(
        "a confirmed payment reopens the salon for 30 days",
        async () => {
          await assert.rejects(
            recordPayment(
              db,
              "00000000-0000-0000-0000-000000000001",
              "a",
              {},
              now,
            ),
            status(404),
          );
          const paid = await recordPayment(
            db,
            admin,
            "a",
            { note: "Голомт" },
            now,
          );
          assert.equal(paid.amountMnt, 150000);
          assert.equal(+new Date(paid.paidUntil), +now + 30 * DAY);
          const billing = await salonBilling(db, "a", now);
          assert.equal(billing.state, "PAID");
          assert.equal(billing.choice, "CONTINUE");
          assert.equal(billing.askChoice, false);
          assert.equal(billing.payments[0].amountMnt, 150000);
          assert.equal(
            (await publicCatalog(db, "salon-a")).salon.slug,
            "salon-a",
          );
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
