import type { PrismaClient } from "@prisma/client";
import { categorySchema, serviceSchema } from "../validation";
import {
  type Actor,
  refreshActor,
  requireOwner,
  requireBranch,
  assertActiveBranches,
} from "../access";
import { HttpError } from "../errors";
export async function readCatalog(
  db: PrismaClient,
  actor: Actor,
  branchId?: string,
) {
  if (branchId) requireBranch(actor, branchId);
  const owner = actor.role === "SALON_OWNER";
  const branchFilter = {
    salonId: actor.salonId,
    ...(branchId
      ? { branchId }
      : owner
        ? {}
        : { branchId: { in: actor.branchIds } }),
    ...(owner ? {} : { branch: { active: true } }),
  };
  const services = await db.service.findMany({
    where: {
      salonId: actor.salonId,
      ...(actor.role === "STAFF"
        ? {
            staff: {
              some: { staffId: actor.staffId ?? "", salonId: actor.salonId },
            },
          }
        : {}),
      ...(!owner ? { active: true, category: { active: true } } : {}),
      ...(!owner || branchId ? { branches: { some: branchFilter } } : {}),
    },
    include: { branches: { where: branchFilter, select: { branchId: true } } },
    orderBy: { name: "asc" },
  });
  const categories = await db.serviceCategory.findMany({
    where: {
      salonId: actor.salonId,
      ...(owner
        ? {}
        : { id: { in: services.map((s) => s.categoryId) }, active: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
      sortOrder: c.sortOrder,
    })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      categoryId: s.categoryId,
      priceMnt: s.priceMnt,
      durationMinutes: s.durationMinutes,
      discountPercent: s.discountPercent,
      active: s.active,
      onlineBookable: s.onlineBookable,
      branchIds: s.branches.map((b) => b.branchId),
    })),
  };
}
export type CatalogData = Awaited<ReturnType<typeof readCatalog>>;
export async function saveCategory(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const data = categorySchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      if (id) {
        const result = await tx.serviceCategory.updateMany({
          where: { id, salonId: current.salonId },
          data,
        });
        if (!result.count) throw new HttpError(404, "Ангилал олдсонгүй.");
        return { id };
      }
      return tx.serviceCategory.create({
        data: { ...data, salonId: current.salonId },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
export async function saveService(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const { branchIds, ...data } = serviceSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      if (
        id &&
        !(await tx.service.findFirst({
          where: { id, salonId: current.salonId },
        }))
      )
        throw new HttpError(404, "Үйлчилгээ олдсонгүй.");
      if (
        !(await tx.serviceCategory.findFirst({
          where: {
            id: data.categoryId,
            salonId: current.salonId,
            ...(data.active ? { active: true } : {}),
          },
        }))
      )
        throw new HttpError(400, "Өөрийн салоны хүчинтэй ангиллыг сонгоно уу.");
      if (data.active) await assertActiveBranches(tx, current, branchIds);
      else if (
        (await tx.branch.count({
          where: { id: { in: branchIds }, salonId: current.salonId },
        })) !== branchIds.length
      )
        throw new HttpError(403, "Сонгосон салбарт хандах эрхгүй байна.");
      if (id) {
        if (
          await tx.staffService.count({
            where: {
              serviceId: id,
              salonId: current.salonId,
              staff: { branches: { none: { branchId: { in: branchIds } } } },
            },
          })
        )
          throw new HttpError(
            409,
            "Энэ үйлчилгээг үзүүлдэг ажилтны салбарын хуваарилалтыг эхлээд өөрчилнө үү.",
          );
        await tx.serviceBranch.deleteMany({
          where: {
            serviceId: id,
            salonId: current.salonId,
            branchId: { notIn: branchIds },
          },
        });
        await tx.service.update({
          where: { id_salonId: { id, salonId: current.salonId } },
          data,
        });
        await tx.serviceBranch.createMany({
          data: branchIds.map((branchId) => ({
            serviceId: id,
            branchId,
            salonId: current.salonId,
          })),
          skipDuplicates: true,
        });
        return { id };
      }
      return tx.service.create({
        data: {
          ...data,
          salonId: current.salonId,
          branches: {
            create: branchIds.map((branchId) => ({
              branchId,
            })),
          },
        },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
