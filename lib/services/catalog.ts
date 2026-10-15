import type { Prisma, PrismaClient } from "@prisma/client";
import type { z } from "zod";
import {
  categorySchema,
  serviceSchema,
  serviceTemplatesSchema,
} from "../validation";
import { templatesFor } from "../service-templates";
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
      imageUrl: s.imageUrl,
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
      return writeCategory(tx, current, data, id);
    },
    { isolationLevel: "Serializable" },
  );
}
// Writers run inside the caller's transaction after the owner check.
async function writeCategory(
  tx: Prisma.TransactionClient,
  current: Actor,
  data: z.output<typeof categorySchema>,
  id?: string,
) {
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
}
export async function saveService(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const input = serviceSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      return writeService(tx, current, input, id);
    },
    { isolationLevel: "Serializable" },
  );
}
async function writeService(
  tx: Prisma.TransactionClient,
  current: Actor,
  { branchIds, ...data }: z.output<typeof serviceSchema>,
  id?: string,
) {
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
}
// Starter services from the salon's onboarding service types. Each one goes
// through the same validation and writers as a hand-made service, attached
// to the main (first) branch; missing categories are created on the way.
export async function addServiceTemplates(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const { items } = serviceTemplatesSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      const salonId = current.salonId;
      const { serviceTypes } = await tx.salon.findUniqueOrThrow({
        where: { id: salonId },
        select: { serviceTypes: true },
      });
      const offered = templatesFor(serviceTypes);
      const chosen = items.map(({ id, priceMnt }) => {
        const template = offered.find((t) => t.id === id);
        if (!template)
          throw new HttpError(
            400,
            "Сонгосон үйлчилгээ таны салоны үйлчилгээний төрөлд хамаарахгүй байна.",
          );
        return { ...template, priceMnt };
      });
      const branch = await tx.branch.findFirst({
        where: { salonId, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!branch) throw new HttpError(400, "Эхлээд салбар нэмнэ үү.");
      // A repeated click does not duplicate services that already exist.
      const existing = new Set(
        (
          await tx.service.findMany({
            where: { salonId, name: { in: chosen.map((t) => t.name) } },
            select: { name: true },
          })
        ).map((s) => s.name),
      );
      const categories = new Map(
        (
          await tx.serviceCategory.findMany({
            where: { salonId, name: { in: chosen.map((t) => t.category) } },
            select: { id: true, name: true },
          })
        ).map((c) => [c.name, c.id]),
      );
      let sortOrder = await tx.serviceCategory.count({ where: { salonId } });
      let created = 0;
      for (const t of chosen) {
        if (existing.has(t.name)) continue;
        let categoryId = categories.get(t.category);
        if (!categoryId) {
          ({ id: categoryId } = await writeCategory(
            tx,
            current,
            categorySchema.parse({
              name: t.category,
              sortOrder: sortOrder++,
              active: true,
            }),
          ));
          categories.set(t.category, categoryId);
        }
        await writeService(
          tx,
          current,
          serviceSchema.parse({
            name: t.name,
            description: "",
            categoryId,
            priceMnt: t.priceMnt,
            durationMinutes: t.durationMinutes,
            onlineBookable: true,
            active: true,
            branchIds: [branch.id],
          }),
        );
        created++;
      }
      return { created };
    },
    { isolationLevel: "Serializable" },
  );
}
