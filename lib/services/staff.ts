import type { Prisma, PrismaClient } from "@prisma/client";
import {
  type Actor,
  refreshActor,
  requireOwner,
  requireBranch,
  assertActiveBranches,
} from "../access";
import { HttpError } from "../errors";
import { staffSchema, hoursSchema, timeOffSchema } from "../validation";

function scopedAssignment(
  actor: Actor,
  branchId?: string,
): Prisma.StaffBranchWhereInput {
  if (branchId) requireBranch(actor, branchId);
  return {
    salonId: actor.salonId,
    ...(branchId
      ? { branchId }
      : actor.role === "SALON_OWNER"
        ? {}
        : { branchId: { in: actor.branchIds } }),
    ...(actor.role === "SALON_OWNER" ? {} : { branch: { active: true } }),
  };
}
export async function readStaff(
  db: PrismaClient,
  actor: Actor,
  branchId?: string,
) {
  const scope = scopedAssignment(actor, branchId);
  const owner = actor.role === "SALON_OWNER";
  const rows = await db.staff.findMany({
    where: {
      salonId: actor.salonId,
      ...(owner ? {} : { active: true }),
      ...(actor.role === "STAFF" ? { id: actor.staffId ?? "" } : {}),
      ...(!owner || branchId ? { branches: { some: scope } } : {}),
    },
    include: {
      branches: { where: scope, select: { branchId: true } },
      services: {
        where: {
          service: {
            ...(owner ? {} : { active: true, category: { active: true } }),
            branches: {
              some: {
                salonId: actor.salonId,
                ...(owner ? {} : { branchId: { in: actor.branchIds } }),
              },
            },
          },
        },
        select: { serviceId: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    phone:
      owner || actor.role === "MANAGER" || s.id === actor.staffId
        ? (s.phone ?? "")
        : "",
    bio: s.bio ?? "",
    active: s.active,
    memberId: owner ? s.memberId : null,
    branchIds: s.branches.map((b) => b.branchId),
    serviceIds: s.services.map((x) => x.serviceId),
  }));
}
export type StaffData = Awaited<ReturnType<typeof readStaff>>;
export async function saveStaff(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const { branchIds, serviceIds, ...data } = staffSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      if (
        id &&
        !(await tx.staff.findFirst({ where: { id, salonId: current.salonId } }))
      )
        throw new HttpError(404, "Ажилтан олдсонгүй.");
      if (data.active) await assertActiveBranches(tx, current, branchIds);
      else if (
        (await tx.branch.count({
          where: { id: { in: branchIds }, salonId: current.salonId },
        })) !== branchIds.length
      )
        throw new HttpError(403, "Сонгосон салбарт хандах эрхгүй байна.");
      if (
        data.memberId &&
        !(await tx.salonMember.findFirst({
          where: {
            id: data.memberId,
            salonId: current.salonId,
            ...(data.active ? { active: true } : {}),
          },
        }))
      )
        throw new HttpError(
          400,
          "Өөрийн салоны идэвхтэй гишүүнийг сонгоно уу.",
        );
      if (
        (await tx.service.count({
          where: {
            id: { in: serviceIds },
            salonId: current.salonId,
            ...(data.active
              ? { active: true, category: { active: true } }
              : {}),
            branches: {
              some: { branchId: { in: branchIds }, salonId: current.salonId },
            },
          },
        })) !== serviceIds.length
      )
        throw new HttpError(
          400,
          "Ажилтны салбарт үзүүлдэг үйлчилгээг сонгоно уу.",
        );
      if (id) {
        const removed = {
          staffId: id,
          salonId: current.salonId,
          branchId: { notIn: branchIds },
        };
        if (
          (await tx.workingHours.count({ where: removed })) ||
          (await tx.timeOff.count({ where: removed }))
        )
          throw new HttpError(
            409,
            "Салбарын хуваарь, чөлөөг эхлээд устгаад салбарын хуваарилалтыг өөрчилнө үү.",
          );
        await tx.staffBranch.deleteMany({ where: removed });
        await tx.staffService.deleteMany({
          where: {
            staffId: id,
            salonId: current.salonId,
            serviceId: { notIn: serviceIds },
          },
        });
        await tx.staff.update({
          where: { id_salonId: { id, salonId: current.salonId } },
          data,
        });
      } else {
        id = (
          await tx.staff.create({ data: { ...data, salonId: current.salonId } })
        ).id;
      }
      await tx.staffBranch.createMany({
        data: branchIds.map((branchId) => ({
          staffId: id!,
          branchId,
          salonId: current.salonId,
        })),
        skipDuplicates: true,
      });
      await tx.staffService.createMany({
        data: serviceIds.map((serviceId) => ({
          staffId: id!,
          serviceId,
          salonId: current.salonId,
        })),
        skipDuplicates: true,
      });
      return { id };
    },
    { isolationLevel: "Serializable" },
  );
}
async function writableAssignment(
  tx: Prisma.TransactionClient,
  actor: Actor,
  staffId: string,
  branchId: string,
) {
  requireBranch(actor, branchId, true);
  if (
    !(await tx.staffBranch.findFirst({
      where: {
        staffId,
        branchId,
        salonId: actor.salonId,
        branch: { active: true },
        staff: { active: true },
      },
    }))
  )
    throw new HttpError(
      403,
      "Ажилтан энэ салбарт хуваарилагдаагүй эсвэл идэвхгүй байна.",
    );
}
export async function readSchedules(
  db: PrismaClient,
  actor: Actor,
  branchId?: string,
) {
  const staff = await readStaff(db, actor, branchId);
  const scope = {
    salonId: actor.salonId,
    staffId: { in: staff.map((s) => s.id) },
    ...(branchId
      ? { branchId }
      : actor.role === "SALON_OWNER"
        ? {}
        : { branchId: { in: actor.branchIds } }),
  };
  const [hours, timeOff] = await Promise.all([
    db.workingHours.findMany({
      where: scope,
      include: { breaks: { orderBy: { startMinute: "asc" } } },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    db.timeOff.findMany({ where: scope, orderBy: { startsAt: "asc" } }),
  ]);
  return {
    staff,
    hours: hours.map((h) => ({
      id: h.id,
      staffId: h.staffId,
      branchId: h.branchId,
      dayOfWeek: h.dayOfWeek,
      startMinute: h.startMinute,
      endMinute: h.endMinute,
      active: h.active,
      breaks: h.breaks.map((b) => ({
        startMinute: b.startMinute,
        endMinute: b.endMinute,
      })),
    })),
    timeOff: timeOff.map((t) => ({
      id: t.id,
      staffId: t.staffId,
      branchId: t.branchId,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt.toISOString(),
      fullDay: t.fullDay,
      ...(actor.role === "SALON_OWNER" ||
      actor.role === "MANAGER" ||
      t.staffId === actor.staffId
        ? { reason: t.reason ?? "" }
        : {}),
    })),
  };
}
export type ScheduleData = Awaited<ReturnType<typeof readSchedules>>;
export async function saveHours(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const { breaks, ...data } = hoursSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      if (id) {
        const old = await tx.workingHours.findFirst({
          where: { id, salonId: current.salonId },
        });
        if (!old) throw new HttpError(404, "Хуваарь олдсонгүй.");
        requireBranch(current, old.branchId, true);
      }
      await writableAssignment(tx, current, data.staffId, data.branchId);
      if (
        data.active &&
        (await tx.workingHours.findFirst({
          where: {
            salonId: current.salonId,
            staffId: data.staffId,
            dayOfWeek: data.dayOfWeek,
            active: true,
            ...(id ? { id: { not: id } } : {}),
            startMinute: { lt: data.endMinute },
            endMinute: { gt: data.startMinute },
          },
        }))
      )
        throw new HttpError(
          409,
          "Ажилтны ажлын цаг өөр хуваарьтай давхцаж байна.",
        );
      if (id) {
        await tx.workingBreak.deleteMany({
          where: { workingHoursId: id, salonId: current.salonId },
        });
        await tx.workingHours.update({
          where: { id_salonId: { id, salonId: current.salonId } },
          data,
        });
      } else
        id = (
          await tx.workingHours.create({
            data: { ...data, salonId: current.salonId },
          })
        ).id;
      await tx.workingBreak.createMany({
        data: breaks.map((b) => ({
          ...b,
          workingHoursId: id!,
          salonId: current.salonId,
        })),
      });
      return { id };
    },
    { isolationLevel: "Serializable" },
  );
}
export async function saveTimeOff(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  const data = timeOffSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      if (id) {
        const old = await tx.timeOff.findFirst({
          where: { id, salonId: current.salonId },
        });
        if (!old) throw new HttpError(404, "Чөлөөний бүртгэл олдсонгүй.");
        requireBranch(current, old.branchId, true);
      }
      await writableAssignment(tx, current, data.staffId, data.branchId);
      if (
        await tx.timeOff.count({
          where: {
            salonId: current.salonId,
            staffId: data.staffId,
            branchId: data.branchId,
            ...(id ? { id: { not: id } } : {}),
            startsAt: { lt: data.endsAt },
            endsAt: { gt: data.startsAt },
          },
        })
      )
        throw new HttpError(
          409,
          "Чөлөөний хугацаа өмнөх бүртгэлтэй давхцаж байна.",
        );
      return id
        ? tx.timeOff.update({ where: { id }, data, select: { id: true } })
        : tx.timeOff.create({
            data: { ...data, salonId: current.salonId },
            select: { id: true },
          });
    },
    { isolationLevel: "Serializable" },
  );
}
export async function removeSchedule(
  db: PrismaClient,
  actor: Actor,
  kind: "hours" | "timeOff",
  id: string,
) {
  return db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      const where = { id, salonId: current.salonId };
      const row =
        kind === "hours"
          ? await tx.workingHours.findFirst({ where })
          : await tx.timeOff.findFirst({ where });
      if (!row) throw new HttpError(404, "Бүртгэл олдсонгүй.");
      requireBranch(current, row.branchId, true);
      if (kind === "hours") await tx.workingHours.deleteMany({ where });
      else await tx.timeOff.deleteMany({ where });
      return { id };
    },
    { isolationLevel: "Serializable" },
  );
}
