import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { createVisit } from "../../lib/services/visits";
import { publicCatalog } from "../../lib/services/bookings";
import { readManagedVisit } from "../../lib/services/manage";
import {
  listReviews,
  setReviewHidden,
  submitReview,
} from "../../lib/services/reviews";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("guest reviews after a finished visit", { timeout: 120000 }, async () => {
  const fixture = await testDatabase(55474),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    // Weekday hours come from the masters' shifts (every day in the seed).
    const z = (await publicCatalog(db, "salon-a")).branches.find(
      (b) => b.id === "z",
    )!;
    assert.match(z.hours, /^Өдөр бүр \d\d:\d\d–\d\d:\d\d$/);
    const day = addDays(localStamp(new Date()).slice(0, 10), 3);
    const visit = await createVisit(db, "salon-a", {
      branchId: "z",
      items: [{ serviceId: "book-service-a-60" }],
      startAt: localInstant(`${day}T10:00`).toISOString(),
      customer: { name: "Сараа Бат", phone: "88112233" },
      idempotencyKey: randomUUID(),
    });
    const token = visit.manageToken!;
    // Not before the visit has happened.
    await assert.rejects(
      submitReview(db, "salon-a", { token, rating: 5 }),
      status(409),
    );
    await fixture.settle();
    assert.equal(
      (await readManagedVisit(db, "salon-a", token)).canReview,
      false,
    );
    // The salon marks it done, an hour ago.
    const b = visit[0];
    const startAt = new Date(Date.now() - 2 * 3600_000);
    await db.booking.update({
      where: { id: b.id },
      data: {
        status: "COMPLETED",
        startAt,
        endAt: new Date(+startAt + b.durationMinutesSnapshot * 60000),
      },
    });
    assert.equal(
      (await readManagedVisit(db, "salon-a", token)).canReview,
      true,
    );
    await submitReview(db, "salon-a", {
      token,
      rating: 4,
      comment: "Маш сайхан хийсэн.",
    });
    const after = await readManagedVisit(db, "salon-a", token);
    assert.equal(after.canReview, false);
    assert.deepEqual(after.review, {
      rating: 4,
      comment: "Маш сайхан хийсэн.",
    });
    // Once per visit; a wrong token finds nothing.
    await assert.rejects(
      submitReview(db, "salon-a", { token, rating: 1 }),
      status(409),
    );
    await fixture.settle();
    await assert.rejects(
      submitReview(db, "salon-a", { token: "x".repeat(43), rating: 5 }),
      status(404),
    );
    await fixture.settle();
    // Public: first name only, with the average.
    let reviews = (await publicCatalog(db, "salon-a")).reviews;
    assert.equal(reviews.count, 1);
    assert.equal(reviews.average, 4);
    assert.equal(reviews.latest[0].customerName, "Сараа");
    // The master who did it shows the rating too.
    const master = (await publicCatalog(db, "salon-a")).staff.find(
      (p) => p.id === b.staffId,
    )!;
    assert.equal(master.rating, 4);
    assert.equal(master.reviews, 1);
    // The team reads them; only the owner hides one.
    const list = await listReviews(db, actors.manager);
    assert.equal(list.length, 1);
    await assert.rejects(listReviews(db, actors.reception), status(403));
    await assert.rejects(
      setReviewHidden(db, actors.manager, list[0].id, { hidden: true }),
      status(403),
    );
    await fixture.settle();
    await assert.rejects(
      setReviewHidden(db, actors.other, list[0].id, { hidden: true }),
      status(404),
    );
    await fixture.settle();
    await setReviewHidden(db, actors.owner, list[0].id, { hidden: true });
    reviews = (await publicCatalog(db, "salon-a")).reviews;
    assert.equal(reviews.count, 0);
    assert.equal(reviews.average, null);
    // A weekday nobody works reads as a day off.
    await db.workingHours.deleteMany({
      where: { salonId: "a", branchId: "z", dayOfWeek: 7 },
    });
    const sundayOff = (await publicCatalog(db, "salon-a")).branches.find(
      (b) => b.id === "z",
    )!;
    assert.match(sundayOff.hours, /Ня амарна$/);
  } finally {
    await fixture.close();
  }
});
