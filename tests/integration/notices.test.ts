import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  createNotice,
  dismissNotices,
  listNotices,
  noticeRecipients,
  priceNotice,
  unseenNotices,
} from "../../lib/services/notices";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("platform announcements to salons", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55524),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000009";
    await db.user.create({
      data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
    });
    const seen = (id: string) =>
      db.salonMember.findUniqueOrThrow({
        where: { id },
        select: { noticeSeenAt: true },
      });
    await t.test("only the operator sends; input is validated", async () => {
      await assert.rejects(
        createNotice(db, actors.owner.userId, {
          title: "Сайн уу",
          message: "Бүгдэд",
        }),
        status(404),
      );
      for (const bad of [
        { title: "", message: "Текст" },
        { title: "Гарчиг", message: " " },
        { title: "Гарчиг", message: "x".repeat(2001) },
        { title: "Гарчиг", message: "Текст", salonId: "b" },
      ])
        await assert.rejects(createNotice(db, admin, bad));
      await createNotice(db, admin, priceNotice(149000));
      const list = await listNotices(db, admin);
      assert.equal(list.length, 1);
      assert.match(list[0].message, /149/);
    });
    await t.test("every salon sees it until dismissed", async () => {
      for (const actor of [actors.owner, actors.reception, actors.other])
        assert.equal((await unseenNotices(db, await seen(actor.id))).length, 1);
      await dismissNotices(db, actors.owner);
      assert.equal(
        (await unseenNotices(db, await seen(actors.owner.id))).length,
        0,
      );
      // Dismissing is per member: the receptionist still sees it.
      assert.equal(
        (await unseenNotices(db, await seen(actors.reception.id))).length,
        1,
      );
    });
    await t.test("old announcements stop showing", async () => {
      const later = new Date(Date.now() + 31 * 86400000);
      assert.equal(
        (await unseenNotices(db, await seen(actors.reception.id), later))
          .length,
        0,
      );
    });
    await t.test("emails go to owners of approved, active salons", async () => {
      const to = await noticeRecipients(db);
      assert.ok(to.length > 0);
      assert.ok(to.every((e) => e.includes("@")));
      assert.equal(new Set(to).size, to.length);
    });
  } finally {
    await fixture.close();
  }
});
