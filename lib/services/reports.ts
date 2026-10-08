import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { type Actor, refreshActor, requireBranch } from "../access";
import { HttpError } from "../errors";
import { dateSchema } from "../booking-validation";
import { addDays, dayWindow, localStamp } from "../business-time";
type Database = Prisma.TransactionClient;
// Long ranges switch to monthly buckets so the chart stays readable.
const DAILY_LIMIT = 62;
export const reportQuery = z
  .object({
    from: dateSchema,
    to: dateSchema,
    branchId: z.string().min(1).max(100).optional(),
  })
  .strict()
  .refine((v) => v.from <= v.to, "Эхлэх өдөр дуусах өдрөөс өмнө байна.")
  .refine(
    // Object refinements still run when a field is malformed; guard addDays.
    (v) => !validDay(v.from) || v.to <= addDays(v.from, 366),
    "Тайлангийн хугацаа нэг жилээс ихгүй байна.",
  );
function validDay(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
export type ReportQuery = z.infer<typeof reportQuery>;
export function requireReportRole(actor: Actor) {
  if (!["SALON_OWNER", "MANAGER"].includes(actor.role))
    throw new HttpError(403, "Тайлан харах эрхгүй байна.");
}
export function reportRoleAllowed(role: string) {
  return ["SALON_OWNER", "MANAGER"].includes(role);
}
export function monthToDate(now = new Date()) {
  const today = localStamp(now).slice(0, 10);
  return { from: `${today.slice(0, 8)}01`, to: today };
}
type Row = {
  startAt: Date;
  priceSnapshot: number;
  serviceId: string;
  serviceNameSnapshot: string;
  staffId: string;
};
type Bucket = { key: string; revenue: number; count: number };
export function aggregateRevenue(
  rows: Row[],
  range: { from: string; to: string },
  staffNames: Record<string, string> = {},
) {
  const daily = addDays(range.from, DAILY_LIMIT - 1) >= range.to;
  const series = new Map<string, Bucket>();
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    const key = daily ? day : day.slice(0, 7);
    if (!series.has(key)) series.set(key, { key, revenue: 0, count: 0 });
  }
  const services = new Map<string, Bucket & { name: string }>(),
    staff = new Map<string, Bucket & { name: string }>();
  let revenue = 0;
  for (const row of rows) {
    const day = localStamp(row.startAt).slice(0, 10);
    const bucket = series.get(daily ? day : day.slice(0, 7));
    if (!bucket) continue;
    bucket.revenue += row.priceSnapshot;
    bucket.count++;
    revenue += row.priceSnapshot;
    const service = services.get(row.serviceId) ?? {
      key: row.serviceId,
      name: row.serviceNameSnapshot,
      revenue: 0,
      count: 0,
    };
    // Rows arrive oldest first, so the latest snapshot name wins.
    service.name = row.serviceNameSnapshot;
    service.revenue += row.priceSnapshot;
    service.count++;
    services.set(row.serviceId, service);
    const person = staff.get(row.staffId) ?? {
      key: row.staffId,
      name: staffNames[row.staffId] ?? "Ажилтан",
      revenue: 0,
      count: 0,
    };
    person.revenue += row.priceSnapshot;
    person.count++;
    staff.set(row.staffId, person);
  }
  const rank = (a: Bucket, b: Bucket) =>
    b.revenue - a.revenue || b.count - a.count || a.key.localeCompare(b.key);
  const completed = [...series.values()].reduce((n, b) => n + b.count, 0);
  return {
    granularity: daily ? ("day" as const) : ("month" as const),
    revenue,
    completed,
    average: completed ? Math.round(revenue / completed) : 0,
    series: [...series.values()],
    byService: [...services.values()].sort(rank),
    byStaff: [...staff.values()].sort(rank),
  };
}
export async function revenueReport(db: Database, actor: Actor, raw: unknown) {
  const input = reportQuery.parse(raw);
  const current = await refreshActor(db, actor);
  requireReportRole(current);
  if (input.branchId) requireBranch(current, input.branchId);
  const where: Prisma.BookingWhereInput = {
    salonId: current.salonId,
    ...(input.branchId
      ? { branchId: input.branchId }
      : current.role === "SALON_OWNER"
        ? {}
        : { branchId: { in: current.branchIds } }),
    startAt: {
      gte: dayWindow(input.from).start,
      lt: dayWindow(input.to).end,
    },
  };
  const [rows, statuses] = await Promise.all([
    db.booking.findMany({
      where: { ...where, status: "COMPLETED" },
      select: {
        startAt: true,
        priceSnapshot: true,
        serviceId: true,
        serviceNameSnapshot: true,
        staffId: true,
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
    }),
    db.booking.groupBy({
      by: ["status"],
      where: { ...where, status: { in: ["CANCELLED", "NO_SHOW"] } },
      _count: { _all: true },
    }),
  ]);
  const staff = await db.staff.findMany({
    where: {
      salonId: current.salonId,
      id: { in: [...new Set(rows.map((r) => r.staffId))] },
    },
    select: { id: true, name: true },
  });
  const count = (status: string) =>
    statuses.find((s) => s.status === status)?._count._all ?? 0;
  return {
    ...input,
    ...aggregateRevenue(
      rows,
      input,
      Object.fromEntries(staff.map((s) => [s.id, s.name])),
    ),
    cancelled: count("CANCELLED"),
    noShow: count("NO_SHOW"),
  };
}
export type RevenueReport = Awaited<ReturnType<typeof revenueReport>>;
export function emptyReport(range: ReportQuery): RevenueReport {
  return {
    ...range,
    ...aggregateRevenue([], range),
    cancelled: 0,
    noShow: 0,
  };
}
