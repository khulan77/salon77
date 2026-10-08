import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed } from "../fixtures/database";
import { actorFromMember } from "../../lib/access";
import {
  readInventory,
  saveProduct,
  adjustStock,
} from "../../lib/services/inventory";
import { HttpError } from "../../lib/errors";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;
test(
  "inventory products, per-branch stock and role boundaries",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55487),
      { db } = fixture;
    try {
      await seed(db);
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
      const [owner, other, reception, manager] = await Promise.all(
        ["owner", "other", "reception", "manager"].map(actor),
      );
      const product = {
        name: "Гель лак №12",
        sku: "GL-12",
        category: "Хумс",
        unit: "шил",
        costMnt: 18000,
        priceMnt: 35000,
        lowStock: 3,
        active: true,
        stock: [
          { branchId: "z", quantity: 10 },
          { branchId: "y", quantity: 2 },
        ],
      };
      const { id } = await saveProduct(db, owner, product);
      await t.test(
        "owner creates a product with stock per branch",
        async () => {
          const [row] = await readInventory(db, owner);
          assert.equal(row.name, "Гель лак №12");
          assert.deepEqual(row.stock, { z: 10, y: 2 });
          assert.equal(row.costMnt, 18000);
        },
      );
      await t.test("stock moves in and out but never below zero", async () => {
        assert.deepEqual(
          await adjustStock(db, manager, {
            productId: id,
            branchId: "y",
            delta: 5,
          }),
          { quantity: 7 },
        );
        assert.deepEqual(
          await adjustStock(db, owner, {
            productId: id,
            branchId: "z",
            delta: -10,
          }),
          { quantity: 0 },
        );
        await assert.rejects(
          adjustStock(db, owner, { productId: id, branchId: "z", delta: -1 }),
          denied(409),
        );
        await assert.rejects(
          adjustStock(db, owner, { productId: id, branchId: "z", delta: 0 }),
        );
      });
      await t.test(
        "duplicate codes and invalid values are rejected",
        async () => {
          await assert.rejects(
            saveProduct(db, owner, { ...product, name: "Өөр", stock: [] }),
            denied(409),
          );
          await assert.rejects(
            saveProduct(db, owner, { ...product, sku: "", priceMnt: -1 }),
          );
          await assert.rejects(
            saveProduct(db, owner, { ...product, sku: "", unit: "тонн" }),
          );
          // Blank codes are stored as null, so many products may omit them.
          await saveProduct(db, owner, { ...product, sku: "", stock: [] });
          await saveProduct(db, owner, { ...product, sku: " ", stock: [] });
        },
      );
      await t.test(
        "reception reads without cost and cannot write",
        async () => {
          const rows = await readInventory(db, reception);
          assert.ok(rows.every((r) => r.costMnt === null));
          assert.ok(rows.every((r) => !("y" in r.stock)));
          await assert.rejects(
            saveProduct(db, reception, product, id),
            denied(403),
          );
          await assert.rejects(
            adjustStock(db, reception, {
              productId: id,
              branchId: "z",
              delta: 1,
            }),
            denied(403),
          );
        },
      );
      await t.test("tenants are isolated", async () => {
        assert.equal((await readInventory(db, other)).length, 0);
        await assert.rejects(
          saveProduct(db, other, { ...product, stock: [] }, id),
          denied(404),
        );
        await assert.rejects(
          adjustStock(db, other, {
            productId: id,
            branchId: "other",
            delta: 1,
          }),
          denied(404),
        );
        await assert.rejects(
          saveProduct(db, owner, {
            ...product,
            sku: "X",
            stock: [{ branchId: "other", quantity: 1 }],
          }),
          denied(403),
        );
      });
    } finally {
      await fixture.close();
    }
  },
);
