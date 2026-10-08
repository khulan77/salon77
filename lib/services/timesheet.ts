import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireBranch } from "../access";
import { HttpError } from "../errors";
import { dateSchema } from "../booking-validation";
import { addDays, dayWindow, localStamp } from "../business-time";
import { lockStaff } from "./bookings";
type Database = Prisma.TransactionClient;
const id = z.string().min(1).max(100);
export const timesheetQuery = z
  .object({ from: dateSchema, to: dateSchema, branchId: id.optional() })
  .strict()
  .refine((v) => v.from <= v.to, "Эхлэх өдөр дуусах өдрөөс өмнө байна.")
  .refine(
    (v) => !Number.isNaN(Date.parse(v.from)) && v.to <= addDays(v.from, 62),
    "Цагийн бүртгэлийг 2 сараас ихгүй хугацаагаар харна.",
  );
export const attendanceInput = z
  .object({
    staffId: id,
    date: dateSchema,
    status: z.enum(["WORKED", "OFF"]).nullable(),
    // Set after the user confirms marking a day off that already has bookings.
    confirm: z.boolean().default(false),
  })
  .strict();
export function requireTimesheetRole(actor: Actor) {
  if (!["SALON_OWNER", "MANAGER", "RECEPTIONIST"].includes(actor.role))
    throw new HttpError(403, "Цагийн бүртгэл хийх эрхгүй байна.");
}
const day = (date: string) => new Date(`${date}T00:00:00Z`);
function staffScope(actor: Actor, branchId?: string): Prisma.StaffWhereInput {
  const branches = branchId
    ? [branchId]
    : actor.role === "SALON_OWNER"
      ? null
      : actor.branchIds;
  return {
    salonId: actor.salonId,
    active: true,
    ...(branches ? { branches: { some: { branchId: { in: branches } } } } : {}),
  };
}
export async function readTimesheet(db: Database, actor: Actor, raw: unknown) {
  const input = timesheetQuery.parse(raw);
  const current = await refreshActor(db, actor);
  requireTimesheetRole(current);
  if (input.branchId) requireBranch(current, input.branchId);
  const staff = await db.staff.findMany({
    where: staffScope(current, input.branchId),
    select: {
      id: true,
      name: true,
      title: true,
      branches: {
        where: { branch: { active: true } },
        select: { branch: { select: { name: true } } },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const marks = await db.staffAttendance.findMany({
    where: {
      salonId: current.salonId,
      staffId: { in: staff.map((s) => s.id) },
      date: { gte: day(input.from), lte: day(input.to) },
    },
    select: { staffId: true, date: true, status: true },
  });
  return {
    ...input,
    today: localStamp(new Date()).slice(0, 10),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      branches: s.branches.map((b) => b.branch.name),
    })),
    marks: marks.map((m) => ({
      staffId: m.staffId,
      date: m.date.toISOString().slice(0, 10),
      status: m.status,
    })),
  };
}
export type TimesheetData = Awaited<ReturnType<typeof readTimesheet>>;
export async function setAttendance(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  now = new Date(),
) {
  const input = attendanceInput.parse(raw);
  if (input.status === "WORKED" && input.date > localStamp(now).slice(0, 10))
    throw new HttpError(
      400,
      "Ирээдүйн өдрийг «Ажилласан» гэж тэмдэглэх боломжгүй.",
    );
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireTimesheetRole(current);
    const staff = await tx.staff.findFirst({
      where: { ...staffScope(current), id: input.staffId },
      select: { id: true },
    });
    if (!staff) throw new HttpError(404, "Ажилтан олдсонгүй.");
    // Same lock as booking creation, so a day off and a new booking cannot race.
    await lockStaff(tx, [staff.id]);
    if (input.status === "OFF" && !input.confirm) {
      const window = dayWindow(input.date);
      const booked = await tx.booking.count({
        where: {
          salonId: current.salonId,
          staffId: staff.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { lt: window.end },
          endAt: { gt: window.start },
        },
      });
      if (booked)
        throw new HttpError(
          409,
          `Энэ өдөр ${booked} захиалгатай байна. Амралт тэмдэглэсэн ч одоо байгаа захиалга хэвээр үлдэнэ, тэдгээрийг өөр цаг руу шилжүүлнэ үү.`,
        );
    }
    const key = { staffId_date: { staffId: staff.id, date: day(input.date) } };
    if (!input.status) {
      await tx.staffAttendance.deleteMany({
        where: {
          salonId: current.salonId,
          staffId: staff.id,
          date: day(input.date),
        },
      });
      return { staffId: staff.id, date: input.date, status: null };
    }
    await tx.staffAttendance.upsert({
      where: key,
      create: {
        salonId: current.salonId,
        staffId: staff.id,
        date: day(input.date),
        status: input.status,
        updatedByMemberId: current.id,
      },
      update: { status: input.status, updatedByMemberId: current.id },
    });
    return { staffId: staff.id, date: input.date, status: input.status };
  });
}
