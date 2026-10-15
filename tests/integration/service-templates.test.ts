import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { actorFromMember } from "../../lib/access";
import {
  addServiceTemplates,
  readCatalog,
  saveService,
} from "../../lib/services/catalog";
import { templatesFor } from "../../lib/service-templates";
import { HttpError } from "../../lib/errors";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;

test(
  "service templates follow the salon's onboarding service types",
  { timeout: 120000 },
  async () => {
    const fixture = await testDatabase(55499),
      { db } = fixture;
    try {
      await seed(db);
      await db.salon.update({
        where: { id: "a" },
        data: { serviceTypes: ["NAILS"] },
      });
      const actor = async (id: string) =>
        actorFromMember(
          await db.salonMember.findUniqueOrThrow({
            where: { id },
            include: {
              branches: { where: { branch: { active: true } } },
              staff: { include: { branches: true } },
            },
          }),
        );
      const owner = await actor("owner"),
        other = await actor("other"),
        manager = await actor("manager");

      const { serviceTypes } = await db.salon.findUniqueOrThrow({
        where: { id: "a" },
        select: { serviceTypes: true },
      });
      const offered = templatesFor(serviceTypes);
      assert.ok(offered.length >= 3);
      assert.ok(offered.every((t) => t.type === "NAILS"));
      const names = offered.map((t) => t.name);
      assert.ok(names.includes("Гел будалт") && names.includes("Педикюр"));
      assert.equal(
        offered.find((t) => t.id === "nails-gel")?.durationMinutes,
        60,
      );

      const items = [
        { id: "nails-gel", priceMnt: 45000 },
        { id: "nails-pedicure", priceMnt: 55000 },
      ];
      assert.deepEqual(await addServiceTemplates(db, owner, { items }), {
        created: 2,
      });
      const catalog = await readCatalog(db, owner);
      assert.deepEqual(
        catalog.categories.map((c) => [c.name, c.active]),
        [["Хумс", true]],
      );
      const saved = catalog.services
        .map((s) => ({
          name: s.name,
          priceMnt: s.priceMnt,
          durationMinutes: s.durationMinutes,
          categoryId: s.categoryId,
          branchIds: s.branchIds,
          active: s.active,
          onlineBookable: s.onlineBookable,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const category = catalog.categories[0].id;
      assert.deepEqual(saved, [
        {
          name: "Гел будалт",
          priceMnt: 45000,
          durationMinutes: 60,
          categoryId: category,
          branchIds: ["z"],
          active: true,
          onlineBookable: true,
        },
        {
          name: "Педикюр",
          priceMnt: 55000,
          durationMinutes: 60,
          categoryId: category,
          branchIds: ["z"],
          active: true,
          onlineBookable: true,
        },
      ]);

      // A repeated click reuses the category and skips existing services.
      assert.deepEqual(
        await addServiceTemplates(db, owner, {
          items: [...items, { id: "nails-manicure", priceMnt: 35000 }],
        }),
        { created: 1 },
      );
      assert.equal(
        await db.serviceCategory.count({ where: { salonId: "a" } }),
        1,
      );
      assert.equal(await db.service.count({ where: { salonId: "a" } }), 3);
      // The regular service path still works after the refactor.
      await saveService(db, owner, {
        name: "Гараар хийсэн",
        description: "",
        categoryId: category,
        priceMnt: 10000,
        durationMinutes: 30,
        onlineBookable: false,
        active: true,
        branchIds: ["y"],
      });

      await assert.rejects(
        addServiceTemplates(db, owner, {
          items: [{ id: "hair-color", priceMnt: 90000 }],
        }),
        denied(400),
      );
      await assert.rejects(
        addServiceTemplates(db, owner, { items: [{ id: "nails-gel" }] }),
      );
      await assert.rejects(
        addServiceTemplates(db, owner, {
          items: [{ id: "nails-gel", priceMnt: 1, salonId: "b" }],
        }),
      );
      await assert.rejects(
        addServiceTemplates(db, owner, {
          items: [
            { id: "nails-gel", priceMnt: 1 },
            { id: "nails-gel", priceMnt: 2 },
          ],
        }),
      );
      await assert.rejects(
        addServiceTemplates(db, manager, { items }),
        denied(403),
      );
      // Salon b chose no nail services, so nothing leaks into or out of it.
      await assert.rejects(
        addServiceTemplates(db, other, { items }),
        denied(400),
      );
      assert.equal(await db.service.count({ where: { salonId: "b" } }), 0);
      assert.equal(
        await db.serviceCategory.count({ where: { salonId: "b" } }),
        0,
      );
    } finally {
      await fixture.close();
    }
  },
);
