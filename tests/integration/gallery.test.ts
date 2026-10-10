import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { publicCatalog } from "../../lib/services/bookings";
import { listDirectory } from "../../lib/services/directory";
import {
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_BYTES,
  addGalleryImage,
  moveGalleryImage,
  readGallery,
  removeGalleryImage,
} from "../../lib/services/salon-media";
import type { MediaStore } from "../../lib/storage";
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
test("salon photo gallery", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55495),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const { store, objects } = fakeStore();
    await t.test(
      "owners add photos into their own folder, in order",
      async () => {
        let list = await addGalleryImage(db, actors.owner, jpeg, store);
        list = await addGalleryImage(db, actors.owner, jpeg, store);
        list = await addGalleryImage(db, actors.owner, jpeg, store);
        assert.equal(list.length, 3);
        assert.ok(list.every((p) => /\/a\/gallery-.+\.jpg$/.test(p.url)));
        assert.deepEqual(
          (await publicCatalog(db, "salon-a")).salon.images.map((i) => i.url),
          list.map((p) => p.url),
        );
      },
    );
    await t.test(
      "moving reorders; the directory falls back to the first photo",
      async () => {
        const before = await readGallery(db, actors.owner);
        const after = await moveGalleryImage(
          db,
          actors.owner,
          before[2].id,
          "earlier",
        );
        assert.deepEqual(
          after.map((p) => p.id),
          [before[0].id, before[2].id, before[1].id],
        );
        // Moving past either end is a no-op, not an error.
        const same = await moveGalleryImage(
          db,
          actors.owner,
          after[0].id,
          "earlier",
        );
        assert.deepEqual(
          same.map((p) => p.id),
          after.map((p) => p.id),
        );
        const card = (await listDirectory(db, {})).salons.find(
          (s) => s.slug === "salon-a",
        )!;
        assert.equal(card.coverUrl, after[0].url);
        assert.equal(card.photos, 3);
        await db.salon.update({
          where: { id: "a" },
          data: { coverUrl: "https://media.test/c.jpg" },
        });
        const withCover = (await listDirectory(db, {})).salons.find(
          (s) => s.slug === "salon-a",
        )!;
        assert.equal(withCover.coverUrl, "https://media.test/c.jpg");
        assert.equal(withCover.photos, 4);
      },
    );
    await t.test(
      "limits, bad files and missing storage are refused",
      async () => {
        for (let i = 3; i < MAX_GALLERY_IMAGES; i++)
          await addGalleryImage(db, actors.owner, jpeg, store);
        await assert.rejects(
          addGalleryImage(db, actors.owner, jpeg, store),
          status(409),
        );
        assert.equal(
          (await readGallery(db, actors.owner)).length,
          MAX_GALLERY_IMAGES,
        );
        await assert.rejects(
          addGalleryImage(
            db,
            actors.other,
            new TextEncoder().encode("<svg/>"),
            store,
          ),
          status(400),
        );
        const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
        big.set(jpeg);
        await assert.rejects(
          addGalleryImage(db, actors.other, big, store),
          status(413),
        );
        await assert.rejects(
          addGalleryImage(db, actors.other, jpeg, null),
          status(503),
        );
      },
    );
    await t.test(
      "only the owning salon's owner can change its gallery",
      async () => {
        const [first] = await readGallery(db, actors.owner);
        for (const actor of [actors.manager, actors.reception, actors.staff]) {
          await assert.rejects(
            addGalleryImage(db, actor, jpeg, store),
            status(403),
          );
          await assert.rejects(
            removeGalleryImage(db, actor, first.id, store),
            status(403),
          );
          await assert.rejects(readGallery(db, actor), status(403));
        }
        // Another salon's owner cannot see, move or delete it.
        assert.deepEqual(await readGallery(db, actors.other), []);
        await assert.rejects(
          removeGalleryImage(db, actors.other, first.id, store),
          status(404),
        );
        await assert.rejects(
          moveGalleryImage(db, actors.other, first.id, "later"),
          status(404),
        );
        const size = objects.size;
        const left = await removeGalleryImage(
          db,
          actors.owner,
          first.id,
          store,
        );
        assert.equal(left.length, MAX_GALLERY_IMAGES - 1);
        assert.equal(objects.size, size - 1);
      },
    );
  } finally {
    await fixture.close();
  }
});
