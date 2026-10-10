import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { publicCatalog } from "../../lib/services/bookings";
import { listDirectory } from "../../lib/services/directory";
import {
  readApplication,
  resubmitApplication,
} from "../../lib/services/application";
import {
  listApplications,
  platformOverview,
  platformSalonDetail,
  reviewSalon,
} from "../../lib/services/platform";
import { onboardingSchema } from "../../lib/validation";
import { socialUrl } from "../../lib/salon-application";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("salon applications", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55496),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000009";
    await db.user.create({
      data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
    });
    const owner = {
      id: "owner",
      userId: userIds.owner,
      salonId: "a",
      role: "SALON_OWNER",
      branchIds: [],
    };
    const slugs = async () =>
      (await listDirectory(db, {})).salons.map((s) => s.slug).sort();
    const details = {
      name: "Туршилтын салон",
      phone: "99112233",
      description: "",
      instagram: "@test.salon",
      facebook: "",
      serviceTypes: ["NAILS", "HAIR"],
      staffCount: 4,
    };
    await t.test("the sign-up questions are validated", () => {
      const base = {
        ...details,
        slug: "new-salon",
        branch: {
          name: "Төв",
          district: "Хан-Уул",
          address: "Хаяг",
          phone: "99112233",
        },
      };
      assert.equal(onboardingSchema.safeParse(base).success, true);
      for (const bad of [
        { instagram: "", facebook: "" },
        { serviceTypes: [] },
        { serviceTypes: ["UNKNOWN"] },
        { staffCount: 0 },
        { staffCount: 2.5 },
        { instagram: "two words" },
      ])
        assert.equal(
          onboardingSchema.safeParse({ ...base, ...bad }).success,
          false,
          JSON.stringify(bad),
        );
      assert.equal(
        onboardingSchema.safeParse({
          ...base,
          instagram: "",
          facebook: "facebook.com/test.salon",
        }).success,
        true,
      );
    });
    await t.test("social links only ever point at the named network", () => {
      assert.equal(
        socialUrl("instagram", "@test.salon"),
        "https://instagram.com/test.salon",
      );
      assert.equal(
        socialUrl("instagram", "https://www.instagram.com/test.salon/?hl=en"),
        "https://instagram.com/test.salon",
      );
      assert.equal(
        socialUrl("facebook", "fb.com/test.salon"),
        "https://facebook.com/test.salon",
      );
      assert.equal(socialUrl("facebook", "javascript:alert(1)"), null);
      assert.equal(socialUrl("instagram", "https://evil.example/x"), null);
      assert.equal(socialUrl("instagram", ""), null);
    });
    await t.test("existing salons stay approved and public", async () => {
      assert.deepEqual(await slugs(), ["salon-a", "salon-b"]);
      assert.equal((await readApplication(db, owner)).status, "APPROVED");
      await assert.rejects(
        resubmitApplication(db, owner, details),
        status(409),
      );
      assert.deepEqual(await listApplications(db, admin), []);
    });
    await t.test("a pending salon is hidden from the public", async () => {
      await db.salon.update({
        where: { id: "a" },
        data: { reviewStatus: "PENDING", submittedAt: new Date() },
      });
      assert.deepEqual(await slugs(), ["salon-b"]);
      await assert.rejects(publicCatalog(db, "salon-a"), status(404));
      // The owner still works inside the salon.
      assert.equal((await readApplication(db, owner)).status, "PENDING");
      const queue = await listApplications(db, admin);
      assert.deepEqual(
        queue.map((a) => a.id),
        ["a"],
      );
      assert.equal(queue[0].ownerEmail, "owner@example.test");
      assert.equal(queue[0].resubmitted, false);
      assert.equal((await platformOverview(db, admin)).salons.pending, 1);
    });
    await t.test("only the platform operator decides", async () => {
      for (const userId of [userIds.owner, userIds.other, userIds.manager]) {
        await assert.rejects(
          reviewSalon(db, userId, "a", { decision: "APPROVE" }),
          status(404),
        );
        await assert.rejects(listApplications(db, userId), status(404));
      }
      await assert.rejects(
        reviewSalon(db, admin, "missing", { decision: "APPROVE" }),
        status(404),
      );
      await assert.rejects(reviewSalon(db, admin, "a", { decision: "REJECT" }));
      await assert.rejects(
        reviewSalon(db, admin, "a", { decision: "REJECT", note: " " }),
      );
      await assert.rejects(reviewSalon(db, admin, "a", { decision: "DELETE" }));
      await fixture.settle();
    });
    await t.test("rejected with a reason, corrected, sent again", async () => {
      await reviewSalon(db, admin, "a", {
        decision: "REJECT",
        note: "Инстаграм хаяг буруу байна.",
      });
      const rejected = await readApplication(db, owner);
      assert.equal(rejected.status, "REJECTED");
      assert.equal(rejected.note, "Инстаграм хаяг буруу байна.");
      assert.deepEqual(await slugs(), ["salon-b"]);
      assert.deepEqual(await listApplications(db, admin), []);
      // Only the owner may resubmit, and only for their own salon.
      await assert.rejects(
        resubmitApplication(db, actors.reception, details),
        status(403),
      );
      await assert.rejects(
        resubmitApplication(db, owner, { ...details, instagram: "" }),
      );
      await assert.rejects(
        resubmitApplication(db, owner, {
          ...details,
          reviewStatus: "APPROVED",
        }),
      );
      const sent = await resubmitApplication(db, owner, {
        ...details,
        instagram: "@fixed.salon",
      });
      assert.equal(sent.status, "PENDING");
      assert.equal(sent.note, "");
      assert.equal(sent.instagram, "@fixed.salon");
      assert.deepEqual(sent.serviceTypes, ["NAILS", "HAIR"]);
      const queue = await listApplications(db, admin);
      assert.equal(queue.length, 1);
      assert.equal(queue[0].resubmitted, true);
      assert.equal(queue[0].staffCount, 4);
      // Another salon's row is untouched.
      const other = await db.salon.findUniqueOrThrow({ where: { id: "b" } });
      assert.equal(other.reviewStatus, "APPROVED");
      assert.equal(other.instagram, null);
    });
    await t.test("approval opens the salon and is audited", async () => {
      await reviewSalon(db, admin, "a", { decision: "APPROVE" });
      assert.deepEqual(await slugs(), ["salon-a", "salon-b"]);
      assert.equal((await publicCatalog(db, "salon-a")).salon.slug, "salon-a");
      const detail = await platformSalonDetail(db, admin, "a");
      assert.equal(detail.application.status, "APPROVED");
      assert.equal(detail.application.instagram, "@fixed.salon");
      assert.deepEqual(detail.audit.map((a) => a.action).sort(), [
        "APPROVE_SALON",
        "REJECT_SALON",
      ]);
      // Approving twice writes no second audit row.
      await reviewSalon(db, admin, "a", { decision: "APPROVE" });
      assert.equal(
        await db.platformAuditLog.count({ where: { salonId: "a" } }),
        2,
      );
      assert.equal((await platformOverview(db, admin)).salons.pending, 0);
    });
  } finally {
    await fixture.close();
  }
});
