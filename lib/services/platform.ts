import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { addDays, localStamp } from "../business-time";
type Database = Prisma.TransactionClient;
const DAY = 86400000;
// 404 rather than 403 so the console's existence is not revealed.
export const platformNotFound = "Хуудас олдсонгүй.";
export async function assertPlatformAdmin(db: Database, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  if (!user?.isSuperAdmin) throw new HttpError(404, platformNotFound);
}
// Online bookings per Ulaanbaatar day for the last `days` days (oldest first).
async function onlinePerDay(
  db: Database,
  now: Date,
  days: number,
  salonId?: string,
) {
  const since = new Date(+now - days * DAY);
  const rows = await db.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar')::date, 'YYYY-MM-DD') AS day,
           count(*) AS count
    FROM "Booking"
    WHERE "source" = 'ONLINE'
      AND "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')
      ${salonId ? Prisma.sql`AND "salonId" = ${salonId}` : Prisma.empty}
    GROUP BY 1`;
  const counts = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const today = localStamp(now).slice(0, 10);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, count: counts.get(day) ?? 0 };
  });
}
// New salons per Monday-starting Ulaanbaatar week for the last `weeks` weeks.
async function salonsPerWeek(db: Database, now: Date, weeks: number) {
  const today = localStamp(now).slice(0, 10);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  const first = addDays(monday, -(weeks - 1) * 7);
  const rows = await db.$queryRaw<{ week: string; count: bigint }[]>`
    SELECT to_char(date_trunc('week', (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar'))::date, 'YYYY-MM-DD') AS week,
           count(*) AS count
    FROM "Salon"
    WHERE "createdAt" >= ((${`${first}T00:00:00+08:00`}::timestamptz) AT TIME ZONE 'UTC')
    GROUP BY 1`;
  const counts = new Map(rows.map((r) => [r.week, Number(r.count)]));
  return Array.from({ length: weeks }, (_, i) => {
    const day = addDays(first, i * 7);
    return { day, count: counts.get(day) ?? 0 };
  });
}
export async function platformOverview(
  db: Database,
  adminUserId: string,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  const ago = (days: number) => new Date(+now - days * DAY);
  const startOfToday = new Date(
    `${localStamp(now).slice(0, 10)}T00:00:00+08:00`,
  );
  const online = (since: Date) =>
    db.booking.count({
      where: { source: "ONLINE", createdAt: { gte: since } },
    });
  const [
    byStatus,
    new7,
    new30,
    branches,
    services,
    staff,
    onlineToday,
    online7,
    online30,
    bookings30,
    daily,
    weekly,
  ] = await Promise.all([
    db.salon.groupBy({ by: ["status"], _count: { _all: true } }),
    db.salon.count({ where: { createdAt: { gte: ago(7) } } }),
    db.salon.count({ where: { createdAt: { gte: ago(30) } } }),
    db.branch.count({ where: { active: true } }),
    db.service.count({ where: { active: true } }),
    db.staff.count({ where: { active: true } }),
    online(startOfToday),
    online(ago(7)),
    online(ago(30)),
    db.booking.count({ where: { createdAt: { gte: ago(30) } } }),
    onlinePerDay(db, now, 30),
    salonsPerWeek(db, now, 12),
  ]);
  const status = (s: string) =>
    byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    salons: {
      total: status("ACTIVE") + status("SUSPENDED"),
      active: status("ACTIVE"),
      suspended: status("SUSPENDED"),
      new7,
      new30,
    },
    branches,
    services,
    staff,
    onlineBookings: { today: onlineToday, days7: online7, days30: online30 },
    bookings30,
    daily,
    weekly,
  };
}
export const salonListQuery = z
  .object({
    query: z.string().trim().max(100).default(""),
    sort: z
      .enum(["newest", "activity", "oldest", "bookings", "name"])
      .default("newest"),
    page: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
const PAGE = 50;
export async function listPlatformSalons(
  db: Database,
  adminUserId: string,
  raw: unknown,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  const input = salonListQuery.parse(raw);
  const where: Prisma.SalonWhereInput = input.query
    ? {
        OR: [
          { name: { contains: input.query, mode: "insensitive" } },
          { slug: { contains: input.query.toLowerCase() } },
        ],
      }
    : {};
  const orderBy: Prisma.SalonOrderByWithRelationInput[] =
    input.sort === "oldest"
      ? [{ createdAt: "asc" }]
      : input.sort === "bookings"
        ? [{ bookings: { _count: "desc" } }, { createdAt: "desc" }]
        : input.sort === "name"
          ? [{ name: "asc" }]
          : [{ createdAt: "desc" }];
  // Latest of the newest booking and the newest member login; Prisma cannot
  // order by that, so one SQL query picks the page of IDs.
  const activityIds =
    input.sort === "activity"
      ? await salonIdsByActivity(db, input.query, input.page)
      : null;
  const [total, found] = await Promise.all([
    db.salon.count({ where }),
    db.salon.findMany({
      where: activityIds ? { id: { in: activityIds } } : where,
      orderBy: [...orderBy, { id: "asc" }],
      ...(activityIds ? {} : { skip: input.page * PAGE, take: PAGE }),
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        members: {
          where: { role: "SALON_OWNER" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            user: { select: { name: true, email: true, lastLoginAt: true } },
          },
        },
        _count: {
          select: {
            branches: { where: { active: true } },
            services: { where: { active: true } },
            staff: { where: { active: true } },
            bookings: true,
          },
        },
      },
    }),
  ]);
  const salons = activityIds
    ? activityIds.flatMap((id) => found.filter((s) => s.id === id))
    : found;
  const ids = salons.map((s) => s.id);
  const [online30, last] = await Promise.all([
    db.booking.groupBy({
      by: ["salonId"],
      where: {
        salonId: { in: ids },
        source: "ONLINE",
        createdAt: { gte: new Date(+now - 30 * DAY) },
      },
      _count: { _all: true },
    }),
    db.booking.groupBy({
      by: ["salonId"],
      where: { salonId: { in: ids } },
      _max: { createdAt: true },
    }),
  ]);
  return {
    ...input,
    total,
    pageSize: PAGE,
    salons: salons.map((s) => {
      const owner = s.members[0]?.user;
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        ownerName: owner?.name ?? "",
        ownerEmail: owner?.email ?? "",
        ownerLastLoginAt: owner?.lastLoginAt?.toISOString() ?? null,
        branches: s._count.branches,
        services: s._count.services,
        staff: s._count.staff,
        bookings: s._count.bookings,
        online30: online30.find((r) => r.salonId === s.id)?._count._all ?? 0,
        lastBookingAt:
          last.find((r) => r.salonId === s.id)?._max.createdAt?.toISOString() ??
          null,
      };
    }),
  };
}
async function salonIdsByActivity(db: Database, query: string, page: number) {
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT s."id"
    FROM "Salon" s
    LEFT JOIN LATERAL (
      SELECT max(b."createdAt") AS at FROM "Booking" b WHERE b."salonId" = s."id"
    ) bk ON true
    LEFT JOIN LATERAL (
      SELECT max(u."lastLoginAt") AS at
      FROM "SalonMember" m JOIN "User" u ON u."id" = m."userId"
      WHERE m."salonId" = s."id"
    ) lg ON true
    WHERE ${query} = '' OR s."name" ILIKE ${like} OR s."slug" LIKE lower(${like})
    ORDER BY GREATEST(bk.at, lg.at) DESC NULLS LAST, s."createdAt" DESC, s."id"
    LIMIT ${PAGE} OFFSET ${page * PAGE}`;
  return rows.map((r) => r.id);
}
export type PlatformSalonList = Awaited<ReturnType<typeof listPlatformSalons>>;
export async function platformSalonDetail(
  db: Database,
  adminUserId: string,
  salonId: string,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  const salon = await db.salon.findUnique({
    where: { id: salonId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      phone: true,
      createdAt: true,
      branches: {
        select: {
          id: true,
          name: true,
          district: true,
          openMinute: true,
          closeMinute: true,
          active: true,
        },
        orderBy: { createdAt: "asc" },
      },
      members: {
        select: {
          id: true,
          role: true,
          active: true,
          user: { select: { name: true, email: true, lastLoginAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      categories: { select: { id: true, name: true } },
      _count: {
        select: {
          services: { where: { active: true } },
          staff: { where: { active: true } },
          bookings: true,
        },
      },
    },
  });
  if (!salon) throw new HttpError(404, platformNotFound);
  const since = new Date(+now - 30 * DAY);
  const [byCategory, bySource, byStatus, last, daily, audit] =
    await Promise.all([
      db.service.groupBy({
        by: ["categoryId"],
        where: { salonId, active: true },
        _count: { _all: true },
      }),
      db.booking.groupBy({
        by: ["source"],
        where: { salonId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.booking.groupBy({
        by: ["status"],
        where: { salonId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.booking.aggregate({
        where: { salonId },
        _max: { createdAt: true },
      }),
      onlinePerDay(db, now, 30, salonId),
      db.platformAuditLog.findMany({
        where: { salonId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          action: true,
          createdAt: true,
          actor: { select: { email: true } },
        },
      }),
    ]);
  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    phone: salon.phone,
    createdAt: salon.createdAt.toISOString(),
    branches: salon.branches,
    members: salon.members.map((m) => ({
      id: m.id,
      role: m.role,
      active: m.active,
      name: m.user.name ?? "",
      email: m.user.email,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
    })),
    services: salon._count.services,
    staff: salon._count.staff,
    bookings: salon._count.bookings,
    lastBookingAt: last._max.createdAt?.toISOString() ?? null,
    servicesByCategory: byCategory
      .map((c) => ({
        name: salon.categories.find((x) => x.id === c.categoryId)?.name ?? "",
        count: c._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    bySource: Object.fromEntries(
      bySource.map((r) => [r.source, r._count._all]),
    ) as Record<string, number>,
    byStatus: Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all]),
    ) as Record<string, number>,
    daily,
    audit: audit.map((a) => ({
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      actorEmail: a.actor.email,
    })),
  };
}
export type PlatformSalonDetail = Awaited<
  ReturnType<typeof platformSalonDetail>
>;
export const salonStatusInput = z
  .object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })
  .strict();
export async function setSalonStatus(
  db: PrismaClient,
  adminUserId: string,
  salonId: string,
  raw: unknown,
) {
  const { status } = salonStatusInput.parse(raw);
  return db.$transaction(async (tx) => {
    await assertPlatformAdmin(tx, adminUserId);
    const salon = await tx.salon.findUnique({
      where: { id: salonId },
      select: { status: true },
    });
    if (!salon) throw new HttpError(404, platformNotFound);
    if (salon.status === status) return { id: salonId, status };
    await tx.salon.update({ where: { id: salonId }, data: { status } });
    await tx.platformAuditLog.create({
      data: {
        actorUserId: adminUserId,
        salonId,
        action: status === "SUSPENDED" ? "SUSPEND_SALON" : "ACTIVATE_SALON",
      },
    });
    return { id: salonId, status };
  });
}
