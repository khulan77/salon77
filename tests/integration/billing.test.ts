import test from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { publicCatalog } from "../../lib/services/bookings";
import { listDirectory } from "../../lib/services/directory";
import {
  approvalRecipient,
  listPlatformSalons,
  platformSalonDetail,
  reviewSalon,
} from "../../lib/services/platform";
import {
  billingOverview,
  recordPayment,
  salonBilling,
  setPricePerBranch,
  setSalonPrice,
} from "../../lib/services/billing";
import { HttpError } from "../../lib/errors";
import { createVisit } from "../../lib/services/visits";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
const DAY = 86400000;
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("monthly billing", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55477),
    { db } = fixture;
  try {
    await seed(db);
    await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000009";
    await db.user.create({
      data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
    });
    const now = new Date();
    await t.test("approval starts a 14-day trial", async () => {
      await db.salon.update({
        where: { id: "a" },
        data: { reviewStatus: "PENDING", submittedAt: now },
      });
      const approved = await reviewSalon(
        db,
        admin,
        "a",
        { decision: "APPROVE" },
        now,
      );
      assert.equal(approved.approvedNow, true);
      // A repeated approval does not greet the owner twice.
      const again = await reviewSalon(db, admin, "a", { decision: "APPROVE" });
      assert.equal(again.approvedNow, false);
      const recipient = await approvalRecipient(db, "a");
      assert.equal(recipient.to, "owner@example.test");
      assert.equal(recipient.salon.slug, "salon-a");
      const salon = await db.salon.findUniqueOrThrow({ where: { id: "a" } });
      assert.equal(+salon.trialEndsAt!, +now + 14 * DAY);
      const billing = await salonBilling(db, "a", now);
      assert.equal(billing.state, "TRIAL");
      assert.equal(billing.daysLeft, 14);
      assert.equal(billing.branches, 2);
      assert.equal(billing.amountMnt, null);
    });
    await t.test(
      "only the operator sets the price and records payments",
      async () => {
        await assert.rejects(
          recordPayment(db, admin, "a", {}, now),
          status(409),
        );
        await assert.rejects(
          setPricePerBranch(db, userIds.owner, { pricePerBranchMnt: 1 }),
          status(404),
        );
        await assert.rejects(
          setPricePerBranch(db, admin, { pricePerBranchMnt: -5 }),
        );
        await setPricePerBranch(db, admin, { pricePerBranchMnt: 149000 });
        await assert.rejects(
          recordPayment(db, userIds.owner, "a", {}, now),
          status(404),
        );
      },
    );
    await t.test("paying during the trial adds 30 days after it", async () => {
      const paid = await recordPayment(db, admin, "a", {}, now);
      // Two active branches at 149,000₮ each.
      assert.equal(paid.amountMnt, 298000);
      assert.equal(+new Date(paid.paidUntil), +now + 44 * DAY);
      const again = await recordPayment(
        db,
        admin,
        "a",
        { note: "Хаан банк" },
        now,
      );
      assert.equal(+new Date(again.paidUntil), +now + 74 * DAY);
      const billing = await salonBilling(db, "a", now);
      assert.equal(billing.state, "PAID");
      assert.equal(billing.payments.length, 2);
      assert.equal(billing.payments[0].note, "Хаан банк");
    });
    await t.test("an expired salon closes to the public", async () => {
      assert.equal((await publicCatalog(db, "salon-a")).salon.slug, "salon-a");
      await db.salon.update({
        where: { id: "a" },
        data: {
          trialEndsAt: new Date(+now - 2 * DAY),
          paidUntil: new Date(+now - DAY),
        },
      });
      await assert.rejects(publicCatalog(db, "salon-a"), status(404));
      const slugs = (await listDirectory(db, {})).salons.map((s) => s.slug);
      assert.ok(!slugs.includes("salon-a"));
      const expired = await listPlatformSalons(db, admin, {
        billing: "expired",
      });
      assert.deepEqual(
        expired.salons.map((s) => s.id),
        ["a"],
      );
      assert.equal(expired.salons[0].billing.state, "EXPIRED");
      const overview = await billingOverview(db, admin, now);
      assert.equal(overview.expired, 1);
      assert.equal(overview.received30Mnt, 596000);
      // Paying again reopens it for 30 days from today.
      const paid = await recordPayment(db, admin, "a", {}, now);
      assert.equal(+new Date(paid.paidUntil), +now + 30 * DAY);
      assert.equal((await publicCatalog(db, "salon-a")).salon.slug, "salon-a");
    });
    await t.test("the operator can set one salon's own fee", async () => {
      await assert.rejects(
        setSalonPrice(db, userIds.owner, "a", { monthlyPriceMnt: 1 }),
        status(404),
      );
      await setSalonPrice(db, admin, "a", { monthlyPriceMnt: 250000 });
      let billing = await salonBilling(db, "a", now);
      assert.equal(billing.customPrice, true);
      assert.equal(billing.amountMnt, 250000);
      const paid = await recordPayment(db, admin, "a", {}, now);
      assert.equal(paid.amountMnt, 250000);
      const listed = await listPlatformSalons(db, admin, {});
      const a = listed.salons.find((s) => s.id === "a")!;
      assert.equal(a.billing.amountMnt, 250000);
      assert.equal(a.billing.customPrice, true);
      assert.equal(typeof a.revenueMonth, "number");
      assert.equal((await billingOverview(db, admin, now)).monthlyMnt, 250000);
      // Clearing it returns to the per-branch price (2 × 149,000₮).
      await setSalonPrice(db, admin, "a", { monthlyPriceMnt: null });
      billing = await salonBilling(db, "a", now);
      assert.equal(billing.customPrice, false);
      assert.equal(billing.amountMnt, 298000);
    });
    await t.test("the operator sees each salon's monthly takings", async () => {
      // Earlier steps failed writes on purpose; start from a clean session.
      await fixture.settle();
      const day = addDays(localStamp(now).slice(0, 10), 3);
      for (const [time, phone] of [
        ["10:00", "88112233"],
        ["12:00", "88112244"],
      ])
        await createVisit(db, "salon-a", {
          branchId: "z",
          items: [{ serviceId: "book-service-a-60" }],
          startAt: localInstant(`${day}T${time}`).toISOString(),
          customer: { name: "Үйлчлүүлэгч", phone },
          idempotencyKey: randomUUID(),
        });
      // Both were served earlier this month.
      const bookings = await db.booking.findMany({ where: { salonId: "a" } });
      assert.equal(bookings.length, 2);
      for (const [i, b] of bookings.entries()) {
        // Keep each booking's length; times stay an hour apart.
        // Never before this month starts, even right after midnight on the 1st.
        const base = Math.max(
          +now,
          +new Date(`${localStamp(now).slice(0, 7)}-01T04:00:00+08:00`),
        );
        const startAt = new Date(base - (i + 2) * 3600_000);
        await db.booking.update({
          where: { id: b.id },
          data: {
            status: "COMPLETED",
            startAt,
            endAt: new Date(+startAt + +b.endAt - +b.startAt),
          },
        });
      }
      const sum = await db.booking.aggregate({
        where: { salonId: "a" },
        _sum: { priceSnapshot: true },
        _count: true,
      });
      const detail = await platformSalonDetail(db, admin, "a", now);
      assert.equal(detail.revenue.length, 6);
      const month = detail.revenue.at(-1)!;
      assert.ok(month.revenue > 0);
      assert.equal(month.revenue, sum._sum.priceSnapshot ?? 0);
      assert.equal(month.count, sum._count);
      const listed = await listPlatformSalons(db, admin, {}, now);
      assert.equal(
        listed.salons.find((s) => s.id === "a")!.revenueMonth,
        sum._sum.priceSnapshot ?? 0,
      );
    });
    await t.test("salons outside onboarding are not billed", async () => {
      const b = await salonBilling(db, "b", now);
      assert.equal(b.state, "FREE");
      assert.equal((await publicCatalog(db, "salon-b")).salon.slug, "salon-b");
      await fixture.settle();
    });
  } finally {
    await fixture.close();
  }
});
