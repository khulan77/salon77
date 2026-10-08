import type { Prisma, PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireBranch } from "../access";
import { HttpError } from "../errors";
import { productSchema, stockAdjustSchema } from "../inventory-validation";
// Owners and managers manage products; reception may only view stock.
function requireInventoryRole(actor: Actor, write = false) {
  const roles = write
    ? ["SALON_OWNER", "MANAGER"]
    : ["SALON_OWNER", "MANAGER", "RECEPTIONIST"];
  if (!roles.includes(actor.role))
    throw new HttpError(403, "Бараа бүртгэлд хандах эрхгүй байна.");
}
function visibleBranches(actor: Actor): Prisma.BranchWhereInput {
  return {
    salonId: actor.salonId,
    ...(actor.role === "SALON_OWNER"
      ? {}
      : { id: { in: actor.branchIds }, active: true }),
  };
}
export async function readInventory(db: PrismaClient, actor: Actor) {
  requireInventoryRole(actor);
  const owner = actor.role === "SALON_OWNER";
  const products = await db.product.findMany({
    where: {
      salonId: actor.salonId,
      ...(owner || actor.role === "MANAGER" ? {} : { active: true }),
    },
    include: {
      stock: {
        where: { branch: visibleBranches(actor) },
        select: { branchId: true, quantity: true },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? "",
    category: p.category,
    unit: p.unit,
    // Purchase cost is business-sensitive; reception sees sale prices only.
    costMnt: actor.role === "RECEPTIONIST" ? null : p.costMnt,
    priceMnt: p.priceMnt,
    lowStock: p.lowStock,
    active: p.active,
    stock: Object.fromEntries(p.stock.map((s) => [s.branchId, s.quantity])),
  }));
}
export type InventoryData = Awaited<ReturnType<typeof readInventory>>;
export async function saveProduct(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const { stock, ...data } = productSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireInventoryRole(current, true);
      if (
        id &&
        !(await tx.product.findFirst({
          where: { id, salonId: current.salonId },
        }))
      )
        throw new HttpError(404, "Бараа олдсонгүй.");
      for (const s of stock) requireBranch(current, s.branchId, true);
      if (
        new Set(stock.map((s) => s.branchId)).size !== stock.length ||
        (await tx.branch.count({
          where: {
            id: { in: stock.map((s) => s.branchId) },
            salonId: current.salonId,
          },
        })) !== stock.length
      )
        throw new HttpError(403, "Сонгосон салбарт хандах эрхгүй байна.");
      if (
        data.sku &&
        (await tx.product.findFirst({
          where: {
            salonId: current.salonId,
            sku: data.sku,
            ...(id ? { id: { not: id } } : {}),
          },
        }))
      )
        throw new HttpError(409, "Энэ кодтой бараа бүртгэгдсэн байна.");
      const product = id
        ? await tx.product.update({
            where: { id_salonId: { id, salonId: current.salonId } },
            data,
          })
        : await tx.product.create({
            data: { ...data, salonId: current.salonId },
          });
      for (const s of stock)
        await tx.productStock.upsert({
          where: {
            productId_branchId: { productId: product.id, branchId: s.branchId },
          },
          create: {
            productId: product.id,
            branchId: s.branchId,
            salonId: current.salonId,
            quantity: s.quantity,
          },
          update: { quantity: s.quantity },
        });
      return { id: product.id };
    },
    { isolationLevel: "Serializable" },
  );
}
// Receive (+) or write off (−) stock; never lets a branch go below zero.
export async function adjustStock(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = stockAdjustSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireInventoryRole(current, true);
      requireBranch(current, input.branchId, true);
      const [product, branch] = await Promise.all([
        tx.product.findFirst({
          where: { id: input.productId, salonId: current.salonId },
        }),
        tx.branch.findFirst({
          where: { id: input.branchId, salonId: current.salonId },
        }),
      ]);
      if (!product || !branch) throw new HttpError(404, "Бараа олдсонгүй.");
      const row = await tx.productStock.findUnique({
        where: {
          productId_branchId: {
            productId: input.productId,
            branchId: input.branchId,
          },
        },
      });
      const quantity = (row?.quantity ?? 0) + input.delta;
      if (quantity < 0)
        throw new HttpError(
          409,
          `Үлдэгдэл хүрэлцэхгүй байна. Одоо ${row?.quantity ?? 0} ${product.unit} байна.`,
        );
      if (quantity > 1_000_000)
        throw new HttpError(400, "Үлдэгдэл хэт их байна.");
      await tx.productStock.upsert({
        where: {
          productId_branchId: {
            productId: input.productId,
            branchId: input.branchId,
          },
        },
        create: {
          productId: input.productId,
          branchId: input.branchId,
          salonId: current.salonId,
          quantity,
        },
        update: { quantity },
      });
      return { quantity };
    },
    { isolationLevel: "Serializable" },
  );
}
