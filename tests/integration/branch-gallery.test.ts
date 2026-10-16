import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { bookingSeed } from "../fixtures/bookings";
import { publicCatalog } from "../../lib/services/bookings";
import { listDirectory } from "../../lib/services/directory";
import { profileChecklist } from "../../lib/services/publish";
import {
  MAX_BRANCH_IMAGES,
  addBranchImage,
  moveBranchImage,
  readBranchGalleries,
  readBranchGallery,
  removeBranchImage,
  removePhoto,
  setPhoto,
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
const mainPhoto = async (
  db: Awaited<ReturnType<typeof testDatabase>>["db"],
  id: string,
) => (await db.branch.findUniqueOrThrow({ where: { id } })).imageUrl ?? null;
test("branch photo galleries", { timeout: 120000 }, async (t) => {
  const fixture = await testDatabase(55520),
    { db } = fixture;
  try {
    await seed(db);
    const actors = await bookingSeed(db);
    const { store, objects } = fakeStore();
    await t.test("each branch keeps its own ordered photos", async () => {
      await addBranchImage(db, actors.owner, "z", jpeg, store);
      await addBranchImage(db, actors.owner, "z", jpeg, store);
      const z = await addBranchImage(db, actors.owner, "z", jpeg, store);
      const y = await addBranchImage(db, actors.owner, "y", jpeg, store);
      assert.equal(z.length, 3);
      assert.equal(y.length, 1);
      assert.ok(z.every((p) => /\/a\/branch-.+\.jpg$/.test(p.url)));
      // The first photo is the main photo the booking page shows on top.
      assert.equal(await mainPhoto(db, "z"), z[0].url);
      const catalog = await publicCatalog(db, "salon-a");
      const zainsan = catalog.branches.find((b) => b.id === "z")!;
      assert.deepEqual(
        zainsan.images.map((i) => i.url),
        z.map((p) => p.url),
      );
      assert.equal(zainsan.imageUrl, z[0].url);
      assert.deepEqual(
        Object.keys(await readBranchGalleries(db, actors.owner)).sort(),
        ["y", "z"],
      );
    });
    await t.test("moving and choosing the main photo", async () => {
      const before = await readBranchGallery(db, actors.owner, "z");
      const later = await moveBranchImage(
        db,
        actors.owner,
        before[0].id,
        "later",
      );
      assert.deepEqual(
        later.map((p) => p.id),
        [before[1].id, before[0].id, before[2].id],
      );
      assert.equal(await mainPhoto(db, "z"), before[1].url);
      const first = await moveBranchImage(
        db,
        actors.owner,
        before[2].id,
        "first",
      );
      assert.deepEqual(
        first.map((p) => p.id),
        [before[2].id, before[1].id, before[0].id],
      );
      assert.equal(await mainPhoto(db, "z"), before[2].url);
      // Past either end is a no-op, not an error.
      const same = await moveBranchImage(
        db,
        actors.owner,
        before[2].id,
        "earlier",
      );
      assert.deepEqual(
        same.map((p) => p.id),
        first.map((p) => p.id),
      );
    });
    await t.test("removing the main photo promotes the next one", async () => {
      const list = await readBranchGallery(db, actors.owner, "z");
      const size = objects.size;
      const after = await removeBranchImage(
        db,
        actors.owner,
        list[0].id,
        store,
      );
      assert.equal(after.length, 2);
      assert.equal(objects.size, size - 1);
      assert.equal(await mainPhoto(db, "z"), list[1].url);
    });
    await t.test("the legacy branch photo maps onto the gallery", async () => {
      const { imageUrl } = await setPhoto(
        db,
        actors.owner,
        "branch",
        "y",
        jpeg,
        store,
      );
      const list = await readBranchGallery(db, actors.owner, "y");
      assert.equal(list.length, 2);
      assert.equal(list[0].url, imageUrl);
      assert.equal(await mainPhoto(db, "y"), imageUrl);
      await removePhoto(db, actors.owner, "branch", "y", store);
      assert.equal((await readBranchGallery(db, actors.owner, "y")).length, 1);
    });
    await t.test("at most ten photos per branch", async () => {
      const room =
        MAX_BRANCH_IMAGES -
        (await readBranchGallery(db, actors.owner, "y")).length;
      for (let i = 0; i < room; i++)
        await addBranchImage(db, actors.owner, "y", jpeg, store);
      await assert.rejects(
        addBranchImage(db, actors.owner, "y", jpeg, store),
        status(409),
      );
    });
    await t.test("only the owner, only their own salon", async () => {
      const [photo] = await readBranchGallery(db, actors.owner, "z");
      for (const actor of [actors.manager, actors.reception]) {
        await assert.rejects(
          addBranchImage(db, actor, "z", jpeg, store),
          status(403),
        );
        await assert.rejects(
          moveBranchImage(db, actor, photo.id, "first"),
          status(403),
        );
        await assert.rejects(
          removeBranchImage(db, actor, photo.id, store),
          status(403),
        );
      }
      // Another salon's owner sees neither the branch nor its photos.
      await assert.rejects(
        addBranchImage(db, actors.other, "z", jpeg, store),
        status(404),
      );
      await assert.rejects(
        readBranchGallery(db, actors.other, "z"),
        status(404),
      );
      await assert.rejects(
        moveBranchImage(db, actors.other, photo.id, "first"),
        status(404),
      );
      await assert.rejects(
        removeBranchImage(db, actors.other, photo.id, store),
        status(404),
      );
      assert.deepEqual(await readBranchGalleries(db, actors.other), {});
      // Reception sees only its own branch's photos on the branches page.
      assert.deepEqual(
        Object.keys(await readBranchGalleries(db, actors.reception)),
        ["z"],
      );
    });
    await t.test("images only, and storage must be configured", async () => {
      await assert.rejects(
        addBranchImage(db, actors.owner, "z", new Uint8Array([1, 2, 3]), store),
        status(400),
      );
      await assert.rejects(
        addBranchImage(db, actors.owner, "z", jpeg, null),
        status(503),
      );
    });
    await t.test(
      "a branch photo stands in for the salon cover in the directory",
      async () => {
        const card = async () =>
          (await listDirectory(db, {})).salons.find(
            (s) => s.slug === "salon-a",
          );
        // No logo or cover: the branch photos alone make the profile complete.
        const [main] = await readBranchGallery(db, actors.owner, "z");
        assert.equal((await card())?.coverUrl, main.url);
        const picture = (await profileChecklist(db, "a")).find(
          (i) => i.key === "picture",
        );
        assert.equal(picture?.done, true);
        // The branch photo still leads when a cover exists.
        await db.salon.update({
          where: { id: "a" },
          data: { coverUrl: "https://media.test/cover.jpg" },
        });
        assert.equal((await card())?.coverUrl, main.url);
        // Without any branch photo the cover takes over; with neither, the
        // salon leaves the directory.
        await db.branch.updateMany({
          where: { salonId: "a" },
          data: { imageUrl: null },
        });
        assert.equal((await card())?.coverUrl, "https://media.test/cover.jpg");
        await db.salon.update({ where: { id: "a" }, data: { coverUrl: null } });
        assert.equal(await card(), undefined);
      },
    );
  } finally {
    await fixture.close();
  }
});
