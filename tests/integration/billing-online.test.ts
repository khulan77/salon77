import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  checkOpenCheckouts,
  openCheckout,
  salonBilling,
  setPricePerBranch,
  settleCheckout,
} from "../../lib/services/billing";
import {
  bylClient,
  validSignature,
  type BylClient,
  type CheckoutState,
} from "../../lib/payments/byl";
import { HttpError } from "../../lib/errors";
const DAY = 86400000;
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
// Stands in for Byl: remembers each checkout and lets the test pay it.
function fakeByl() {
  const pages = new Map<
    number,
    { amount: number; status: CheckoutState; paid: number }
  >();
  let next = 100;
  const client: BylClient = {
    async create({ amountMnt }) {
      const id = next++;
      pages.set(id, { amount: amountMnt, status: "open", paid: 0 });
      return { id, url: `https://byl.test/h/checkout/${id}` };
    },
    async get(id) {
      const page = pages.get(id)!;
      return {
        id,
        url: `https://byl.test/h/checkout/${id}`,
        status: page.status,
        amountTotal: page.paid,
        reference: null,
      };
    },
  };
  return { client, pages, created: () => next - 100 };
}
test("monthly fee paid online through Byl", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55533),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000029";
    await db.user.create({
      data: { id: admin, email: "ops3@example.test", isSuperAdmin: true },
    });
    const now = new Date();
    await db.salon.update({
      where: { id: "a" },
      data: {
        reviewStatus: "APPROVED",
        trialEndsAt: new Date(+now + 2 * DAY),
        paidUntil: null,
      },
    });
    const byl = fakeByl();
    await t.test("needs a price and the owner", async () => {
      await assert.rejects(
        openCheckout(db, actors.owner, byl.client, now),
        status(409),
      );
      await setPricePerBranch(db, admin, { pricePerBranchMnt: 50000 });
      for (const actor of [actors.manager, actors.reception])
        await assert.rejects(
          openCheckout(db, actor, byl.client, now),
          status(403),
        );
      assert.equal(byl.created(), 0);
    });
    let url = "";
    await t.test("opens one page and reuses it", async () => {
      ({ url } = await openCheckout(db, actors.owner, byl.client, now));
      const again = await openCheckout(db, actors.owner, byl.client, now);
      assert.equal(again.url, url);
      assert.equal(byl.created(), 1);
      const row = await db.billingCheckout.findFirstOrThrow({
        where: { salonId: "a" },
      });
      // Two active branches at the per-branch price.
      assert.equal(row.amountMnt, 100000);
      assert.equal(row.status, "OPEN");
    });
    await t.test("an unpaid or underpaid page changes nothing", async () => {
      await checkOpenCheckouts(db, "a", byl.client, now);
      byl.pages.set(100, { amount: 100000, status: "complete", paid: 500 });
      await checkOpenCheckouts(db, "a", byl.client, now);
      const salon = await db.salon.findUniqueOrThrow({ where: { id: "a" } });
      assert.equal(salon.paidUntil, null);
    });
    await t.test("paying extends access once", async () => {
      byl.pages.set(100, { amount: 100000, status: "complete", paid: 100000 });
      await checkOpenCheckouts(db, "a", byl.client, now);
      // The webhook for the same page lands afterwards.
      assert.equal(
        await settleCheckout(db, await byl.client.get(100), now),
        "PAID",
      );
      const salon = await db.salon.findUniqueOrThrow({ where: { id: "a" } });
      // Paying before the trial ends keeps the remaining two days.
      assert.equal(+salon.paidUntil!, +now + 32 * DAY);
      assert.equal(salon.renewalChoice, "CONTINUE");
      const billing = await salonBilling(db, "a", now);
      assert.equal(billing.state, "PAID");
      assert.equal(billing.payments.length, 1);
      assert.equal(billing.payments[0].amountMnt, 100000);
      const payment = await db.salonPayment.findFirstOrThrow({
        where: { salonId: "a" },
        include: { checkout: true },
      });
      assert.equal(payment.recordedById, null);
      assert.equal(payment.checkout?.bylId, 100);
    });
    await t.test("a paid page is not reused; expiry is recorded", async () => {
      const next = await openCheckout(db, actors.owner, byl.client, now);
      assert.notEqual(next.url, url);
      byl.pages.set(101, { amount: 100000, status: "expired", paid: 0 });
      await checkOpenCheckouts(db, "a", byl.client, now);
      const row = await db.billingCheckout.findUniqueOrThrow({
        where: { bylId: 101 },
      });
      assert.equal(row.status, "EXPIRED");
    });
  } finally {
    await fixture.close();
  }
});
test("Byl configuration and webhook signature", () => {
  assert.equal(bylClient({}), null);
  assert.equal(bylClient({ BYL_TOKEN: "t", BYL_PROJECT_ID: "1" }), null);
  assert.ok(
    bylClient({ BYL_TOKEN: "t", BYL_PROJECT_ID: "1", BYL_SIGNING_SECRET: "s" }),
  );
  const body = '{"type":"checkout.completed","data":{"object":{"id":1}}}';
  const sig = createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(validSignature(body, sig, "secret"), true);
  assert.equal(validSignature(body + " ", sig, "secret"), false);
  assert.equal(validSignature(body, sig.slice(1), "secret"), false);
  assert.equal(validSignature(body, null, "secret"), false);
  assert.equal(validSignature(body, sig, ""), false);
});
