import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { saveBookingSettings } from "../../lib/services/booking-settings";
import { defaultBookingSettings } from "../../lib/booking-settings";
import {
  createBooking,
  publicCatalog,
  publicReceipt,
} from "../../lib/services/bookings";
import {
  MAX_IMAGE_BYTES,
  removeSalonCover,
  setSalonCover,
} from "../../lib/services/salon-media";
import type { MediaStore } from "../../lib/storage";
import { localInstant } from "../../lib/business-time";
import { HttpError } from "../../lib/errors";
const status = (code: number) => (e: unknown) =>
  e instanceof HttpError && e.status === code;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
function fakeStore() {
  const objects = new Set<string>();
  const prefix = "https://media.test/salon-media/";
  const store: MediaStore = {
    async upload(path) {
      objects.add(path);
      return prefix + path;
    },
    async remove(path) {
      objects.delete(path);
    },
    pathOf: (url) => (url.startsWith(prefix) ? url.slice(prefix.length) : null),
  };
  return { store, objects };
}
test("deposits and salon cover images", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55485),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const date = "2030-02-11",
      clock = { now: () => localInstant(`${date}T08:00`) };
    const bank = {
      depositBankName: "Хаан банк",
      depositAccountNumber: "5000123456",
      depositAccountHolder: "Туршилтын салон ХХК",
    };
    const book = (time: string, context: Parameters<typeof createBooking>[1]) =>
      createBooking(
        db,
        context,
        {
          branchId: "z",
          serviceId: "book-service-a-60",
          staffId: "book-staff-a-1",
          startAt: localInstant(`${date}T${time}`).toISOString(),
          customer: { name: "Номин", phone: "99112233" },
          idempotencyKey: randomUUID(),
        },
        clock,
      );
    await t.test(
      "deposit settings need bank details and stay bounded in SQL",
      async () => {
        await assert.rejects(
          saveBookingSettings(db, actors.owner, {
            ...defaultBookingSettings,
            depositRequired: true,
          }),
        );
        await assert.rejects(
          db.bookingSettings.update({
            where: { salonId: "a" },
            data: { depositRequired: true },
          }),
        );
        await assert.rejects(
          db.bookingSettings.update({
            where: { salonId: "a" },
            data: { depositType: "PERCENT", depositValue: 150 },
          }),
        );
        await assert.rejects(
          saveBookingSettings(db, actors.manager, {
            ...defaultBookingSettings,
            depositRequired: true,
            ...bank,
          }),
          status(403),
        );
      },
    );
    await t.test(
      "online bookings snapshot the deposit and wait for verification",
      async () => {
        await saveBookingSettings(db, actors.owner, {
          ...defaultBookingSettings,
          bookingConfirmationMode: "AUTO_CONFIRM",
          depositRequired: true,
          depositType: "PERCENT",
          depositValue: 30,
          ...bank,
        });
        const online = await book("10:00", { slug: "salon-a" });
        assert.equal(online.status, "PENDING");
        assert.equal(online.depositAmountSnapshot, 19500);
        const receipt = await publicReceipt(db, online);
        assert.deepEqual(receipt.deposit, {
          amountMnt: 19500,
          bankName: "Хаан банк",
          accountNumber: "5000123456",
          accountHolder: "Туршилтын салон ХХК",
          reference: "99112233",
        });
        const desk = await book("12:00", { actor: actors.reception });
        assert.equal(desk.status, "CONFIRMED");
        assert.equal(desk.depositAmountSnapshot, 0);
        assert.equal((await publicReceipt(db, desk)).deposit, null);
      },
    );
    await t.test(
      "fixed deposits never exceed the price; turning off restores auto-confirm",
      async () => {
        await saveBookingSettings(db, actors.owner, {
          ...defaultBookingSettings,
          bookingConfirmationMode: "AUTO_CONFIRM",
          depositRequired: true,
          depositType: "FIXED",
          depositValue: 900000,
          ...bank,
        });
        assert.equal(
          (await book("15:00", { slug: "salon-a" })).depositAmountSnapshot,
          65000,
        );
        await saveBookingSettings(db, actors.owner, {
          ...defaultBookingSettings,
          bookingConfirmationMode: "AUTO_CONFIRM",
        });
        const plain = await book("16:30", { slug: "salon-a" });
        assert.equal(plain.status, "CONFIRMED");
        assert.equal(plain.depositAmountSnapshot, 0);
      },
    );
    await t.test(
      "owners upload, replace and remove the cover inside their folder",
      async () => {
        const { store, objects } = fakeStore();
        const first = await setSalonCover(db, actors.owner, jpeg, store);
        assert.match(
          first.coverUrl,
          /^https:\/\/media\.test\/salon-media\/a\/cover-.+\.jpg$/,
        );
        assert.equal(
          (await publicCatalog(db, "salon-a")).salon.coverUrl,
          first.coverUrl,
        );
        const second = await setSalonCover(db, actors.owner, jpeg, store);
        assert.notEqual(second.coverUrl, first.coverUrl);
        assert.deepEqual([...objects], [store.pathOf(second.coverUrl)]);
        // A foreign URL is never deleted from storage.
        await db.salon.update({
          where: { id: "a" },
          data: { coverUrl: "https://media.test/salon-media/b/cover-x.jpg" },
        });
        objects.add("b/cover-x.jpg");
        await setSalonCover(db, actors.owner, jpeg, store);
        assert.ok(objects.has("b/cover-x.jpg"));
        await removeSalonCover(db, actors.owner, store);
        assert.equal(
          (await db.salon.findUniqueOrThrow({ where: { id: "a" } })).coverUrl,
          null,
        );
      },
    );
    await t.test(
      "cover uploads reject other roles, bad files and missing storage",
      async () => {
        const { store } = fakeStore();
        for (const actor of [actors.manager, actors.reception, actors.staff])
          await assert.rejects(
            setSalonCover(db, actor, jpeg, store),
            status(403),
          );
        await assert.rejects(
          setSalonCover(
            db,
            actors.owner,
            new TextEncoder().encode("<svg/>"),
            store,
          ),
          status(400),
        );
        const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
        big.set(jpeg);
        await assert.rejects(
          setSalonCover(db, actors.owner, big, store),
          status(413),
        );
        await assert.rejects(
          setSalonCover(db, actors.owner, jpeg, null),
          status(503),
        );
        assert.equal(
          (await db.salon.findUniqueOrThrow({ where: { id: "b" } })).coverUrl,
          null,
        );
      },
    );
  } finally {
    await fixture.close();
  }
});
