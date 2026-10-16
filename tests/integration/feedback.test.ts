import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import {
  answerFeedback,
  listFeedback,
  listOwnFeedback,
  markFeedbackRead,
  sendFeedback,
  unreadFeedbackCount,
} from "../../lib/services/feedback";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
test("salon requests to the platform", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55497),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const admin = "00000000-0000-0000-0000-000000000009";
    await db.user.create({
      data: { id: admin, email: "ops@example.test", isSuperAdmin: true },
    });
    await t.test("members send requests; input is validated", async () => {
      const list = await sendFeedback(db, actors.reception, {
        kind: "BUG",
        message: "Календарь дээр захиалга зөөхөд алдаа гарлаа.",
      });
      assert.equal(list.length, 1);
      assert.equal(list[0].status, "OPEN");
      await sendFeedback(db, actors.owner, {
        kind: "SUGGESTION",
        message: "Тайланг файлаар татдаг болгооч.",
      });
      await sendFeedback(db, actors.other, {
        kind: "QUESTION",
        message: "Урьдчилгааг яаж тохируулах вэ?",
      });
      for (const bad of [
        { kind: "BUG", message: "аа" },
        { kind: "SPAM", message: "Хангалттай урт бичвэр" },
        { kind: "BUG", message: "x".repeat(2001) },
        { kind: "BUG", message: "Хангалттай урт", salonId: "b" },
      ])
        await assert.rejects(sendFeedback(db, actors.owner, bad));
    });
    await t.test("each salon sees only its own requests", async () => {
      // Owner and manager see the salon's; reception sees their own.
      assert.equal((await listOwnFeedback(db, actors.owner)).length, 2);
      assert.equal((await listOwnFeedback(db, actors.manager)).length, 2);
      assert.equal((await listOwnFeedback(db, actors.reception)).length, 1);
      const other = await listOwnFeedback(db, actors.other);
      assert.deepEqual(
        other.map((f) => f.message),
        ["Урьдчилгааг яаж тохируулах вэ?"],
      );
    });
    await t.test("only the operator reads and answers the inbox", async () => {
      for (const userId of [userIds.owner, userIds.manager]) {
        await assert.rejects(listFeedback(db, userId), status(404));
        await assert.rejects(
          answerFeedback(db, userId, "x", { status: "DONE" }),
          status(404),
        );
      }
      const inbox = await listFeedback(db, admin);
      assert.equal(inbox.length, 3);
      assert.equal(inbox[0].salonName, "Туршилтын салон");
      assert.equal(inbox[0].authorEmail, "reception@example.test");
      await assert.rejects(
        answerFeedback(db, admin, "missing", { status: "DONE" }),
        status(404),
      );
      await assert.rejects(
        answerFeedback(db, admin, inbox[0].id, { status: "DELETED" }),
      );
      const answered = await answerFeedback(db, admin, inbox[0].id, {
        status: "DONE",
        reply: "Зассан. Дахин оролдоод үзээрэй.",
      });
      assert.equal(answered.status, "DONE");
      // Answered requests sink below the open ones.
      const after = await listFeedback(db, admin);
      assert.equal(after.at(-1)?.id, inbox[0].id);
      const mine = await listOwnFeedback(db, actors.reception);
      assert.equal(mine[0].reply, "Зассан. Дахин оролдоод үзээрэй.");
      assert.equal(mine[0].status, "DONE");
      assert.equal((await listOwnFeedback(db, actors.other))[0].reply, "");
    });
    await t.test("new requests count as unread until opened", async () => {
      await assert.rejects(unreadFeedbackCount(db, userIds.owner), status(404));
      await assert.rejects(
        markFeedbackRead(db, userIds.owner, []),
        status(404),
      );
      const inbox = await listFeedback(db, admin);
      assert.equal(await unreadFeedbackCount(db, admin), 3);
      assert.ok(inbox.every((f) => f.unread));
      assert.equal(
        await markFeedbackRead(
          db,
          admin,
          inbox.map((f) => f.id),
        ),
        3,
      );
      assert.equal(await unreadFeedbackCount(db, admin), 0);
      assert.ok((await listFeedback(db, admin)).every((f) => !f.unread));
      await sendFeedback(db, actors.other, {
        kind: "QUESTION",
        message: "Шинэ асуулт байна, тусална уу.",
      });
      assert.equal(await unreadFeedbackCount(db, admin), 1);
    });
    await t.test("one account cannot flood the inbox", async () => {
      for (let i = 0; i < 9; i++)
        await sendFeedback(db, actors.owner, {
          kind: "BUG",
          message: `Давтагдсан хүсэлт ${i}`,
        });
      await assert.rejects(
        sendFeedback(db, actors.owner, {
          kind: "BUG",
          message: "Арван нэг дэх хүсэлт",
        }),
        status(429),
      );
      // Other people are unaffected.
      await sendFeedback(db, actors.manager, {
        kind: "BUG",
        message: "Менежерийн хүсэлт",
      });
    });
  } finally {
    await fixture.close();
  }
});
