import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { addDays, localStamp } from "../business-time";
import {
  WARN_DAYS,
  billingState,
  monthlyFee,
  nextPeriod,
  trialEnd,
} from "../billing";
import { pricePerBranch } from "./billing";
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
// Start of the Ulaanbaatar calendar month `back` months before `now`'s.
export function monthStart(now: Date, back = 0) {
  const [y, m] = localStamp(now).slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return new Date(`${d.toISOString().slice(0, 7)}-01T00:00:00+08:00`);
}
// A salon's own takings (completed bookings) per Ulaanbaatar month, oldest
// first, so the operator can see how each salon is doing.
async function revenuePerMonth(
  db: Database,
  salonId: string,
  now: Date,
  months: number,
) {
  const since = monthStart(now, months - 1);
  const rows = await db.$queryRaw<
    { month: string; revenue: bigint; count: bigint }[]
  >`
    SELECT to_char((("startAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar'), 'YYYY-MM') AS month,
           sum("priceSnapshot" + "extraMnt") AS revenue,
           count(*) AS count
    FROM "Booking"
    WHERE "salonId" = ${salonId}
      AND "status" = 'COMPLETED'
      AND "startAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
  return Array.from({ length: months }, (_, i) => {
    const month = localStamp(monthStart(now, months - 1 - i)).slice(0, 7);
    const row = rows.find((r) => r.month === month);
    return {
      month,
      revenue: Number(row?.revenue ?? 0),
      count: Number(row?.count ?? 0),
    };
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
    pending,
    onlineMonth,
    takings,
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
    db.salon.count({ where: { reviewStatus: "PENDING" } }),
    online(monthStart(now)),
    // Every salon's completed bookings this Ulaanbaatar month.
    db.booking.aggregate({
      where: { status: "COMPLETED", startAt: { gte: monthStart(now) } },
      _sum: { priceSnapshot: true, extraMnt: true },
    }),
  ]);
  const status = (s: string) =>
    byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    salons: {
      total: status("ACTIVE") + status("SUSPENDED"),
      active: status("ACTIVE"),
      suspended: status("SUSPENDED"),
      pending,
      new7,
      new30,
    },
    branches,
    services,
    staff,
    onlineBookings: {
      today: onlineToday,
      days7: online7,
      days30: online30,
      month: onlineMonth,
    },
    revenueMonth: (takings._sum.priceSnapshot ?? 0) + (takings._sum.extraMnt ?? 0),
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
    billing: z
      .enum(["all", "pending", "trial", "paid", "due", "expired"])
      .default("all"),
    page: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
const PAGE = 50;
// Salons by where their trial or paid month stands.
function billingWhere(
  filter: z.infer<typeof salonListQuery>["billing"],
  now: Date,
): Prisma.SalonWhereInput {
  const soon = new Date(+now + WARN_DAYS * DAY);
  const endsBy = (at: Date): Prisma.SalonWhereInput[] => [
    { OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: at } }] },
    { OR: [{ paidUntil: null }, { paidUntil: { lte: at } }] },
  ];
  const approved = { reviewStatus: "APPROVED" as const };
  switch (filter) {
    case "pending":
      return { reviewStatus: { not: "APPROVED" } };
    case "trial":
      return {
        ...approved,
        trialEndsAt: { gt: now },
        OR: [{ paidUntil: null }, { paidUntil: { lte: now } }],
      };
    case "paid":
      return { ...approved, paidUntil: { gt: now } };
    case "due":
      return {
        ...approved,
        OR: [{ trialEndsAt: { gt: now } }, { paidUntil: { gt: now } }],
        AND: endsBy(soon),
      };
    case "expired":
      return {
        ...approved,
        OR: [{ trialEndsAt: { not: null } }, { paidUntil: { not: null } }],
        AND: endsBy(now),
      };
    default:
      return {};
  }
}
export async function listPlatformSalons(
  db: Database,
  adminUserId: string,
  raw: unknown,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  const input = salonListQuery.parse(raw);
  const where: Prisma.SalonWhereInput = {
    AND: [
      input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { slug: { contains: input.query.toLowerCase() } },
            ],
          }
        : {},
      billingWhere(input.billing, now),
    ],
  };
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
    input.sort === "activity" && input.billing === "all"
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
        reviewStatus: true,
        trialEndsAt: true,
        paidUntil: true,
        monthlyPriceMnt: true,
        renewalChoice: true,
        phone: true,
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
  const [online30, onlineMonth, last, price, takings] = await Promise.all([
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
      where: {
        salonId: { in: ids },
        source: "ONLINE",
        createdAt: { gte: monthStart(now) },
      },
      _count: { _all: true },
    }),
    db.booking.groupBy({
      by: ["salonId"],
      where: { salonId: { in: ids } },
      _max: { createdAt: true },
    }),
    pricePerBranch(db),
    db.booking.groupBy({
      by: ["salonId"],
      where: {
        salonId: { in: ids },
        status: "COMPLETED",
        startAt: { gte: monthStart(now) },
      },
      _sum: { priceSnapshot: true, extraMnt: true },
    }),
  ]);
  return {
    ...input,
    pricePerBranchMnt: price,
    total,
    pageSize: PAGE,
    salons: salons.map((s) => {
      const owner = s.members[0]?.user;
      const billing = billingState(s, now);
      const branches = Math.max(1, s._count.branches);
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        reviewStatus: s.reviewStatus,
        createdAt: s.createdAt.toISOString(),
        ownerName: owner?.name ?? "",
        ownerEmail: owner?.email ?? "",
        // Entered by the owner at onboarding; the number to call about fees.
        phone: s.phone,
        ownerLastLoginAt: owner?.lastLoginAt?.toISOString() ?? null,
        branches: s._count.branches,
        billing: {
          state: billing.state,
          until: billing.until?.toISOString() ?? null,
          daysLeft: billing.daysLeft,
          warn: billing.warn,
          amountMnt: monthlyFee(s.monthlyPriceMnt, price, branches),
          customPrice: s.monthlyPriceMnt !== null,
          nextEnd: nextPeriod(s, now).end.toISOString(),
        },
        services: s._count.services,
        staff: s._count.staff,
        bookings: s._count.bookings,
        online30: online30.find((r) => r.salonId === s.id)?._count._all ?? 0,
        // Online bookings made this Ulaanbaatar month: the basis for a fee.
        onlineMonth:
          onlineMonth.find((r) => r.salonId === s.id)?._count._all ?? 0,
        renewalChoice: s.renewalChoice,
        // Completed bookings this Ulaanbaatar month.
        revenueMonth: (() => {
          const t = takings.find((r) => r.salonId === s.id)?._sum;
          return (t?.priceSnapshot ?? 0) + (t?.extraMnt ?? 0);
        })(),
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
      description: true,
      instagram: true,
      facebook: true,
      serviceTypes: true,
      staffCount: true,
      reviewStatus: true,
      reviewNote: true,
      submittedAt: true,
      reviewedAt: true,
      createdAt: true,
      branches: {
        select: {
          id: true,
          name: true,
          district: true,
          address: true,
          phone: true,
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
  const [byCategory, bySource, byStatus, last, daily, audit, revenue] =
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
      revenuePerMonth(db, salonId, now, 6),
    ]);
  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    phone: salon.phone,
    application: {
      status: salon.reviewStatus,
      note: salon.reviewNote ?? "",
      description: salon.description ?? "",
      instagram: salon.instagram ?? "",
      facebook: salon.facebook ?? "",
      serviceTypes: salon.serviceTypes,
      staffCount: salon.staffCount,
      submittedAt: salon.submittedAt?.toISOString() ?? null,
      reviewedAt: salon.reviewedAt?.toISOString() ?? null,
    },
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
    revenue,
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
export const salonDeleteInput = z
  .object({ confirmName: z.string().trim().min(1).max(200) })
  .strict();
// Removes a salon and everything it owns, for good. Bookings, customers and
// schedules are protected from a plain cascade, so they go first, in order;
// the audit log keeps the salon's name after it is gone.
export async function deleteSalon(
  db: PrismaClient,
  adminUserId: string,
  salonId: string,
  raw: unknown,
) {
  const { confirmName } = salonDeleteInput.parse(raw);
  return db.$transaction(
    async (tx) => {
      await assertPlatformAdmin(tx, adminUserId);
      const salon = await tx.salon.findUnique({
        where: { id: salonId },
        select: { name: true },
      });
      if (!salon) throw new HttpError(404, platformNotFound);
      if (salon.name.trim() !== confirmName)
        throw new HttpError(
          400,
          "Устгахын тулд салоны нэрийг яг таг бичнэ үү.",
        );
      const where = { salonId };
      await tx.review.deleteMany({ where });
      await tx.notification.deleteMany({ where });
      await tx.bookingActivity.deleteMany({ where });
      await tx.booking.deleteMany({ where });
      await tx.staffAttendance.deleteMany({ where });
      await tx.timeOff.deleteMany({ where });
      await tx.workingHours.deleteMany({ where });
      await tx.customer.deleteMany({ where });
      await tx.platformAuditLog.create({
        data: {
          actorUserId: adminUserId,
          salonId,
          salonName: salon.name,
          action: "DELETE_SALON",
        },
      });
      await tx.salon.delete({ where: { id: salonId } });
      return { id: salonId, deleted: true };
    },
    { timeout: 30000 },
  );
}
// Salons waiting for a decision, longest wait first.
export async function listApplications(
  db: Database,
  adminUserId: string,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  const salons = await db.salon.findMany({
    where: { reviewStatus: "PENDING" },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      instagram: true,
      facebook: true,
      serviceTypes: true,
      staffCount: true,
      submittedAt: true,
      createdAt: true,
      reviewedAt: true,
      branches: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { district: true, address: true },
      },
      members: {
        where: { role: "SALON_OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { name: true, email: true } } },
      },
    },
  });
  return salons.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    instagram: s.instagram ?? "",
    facebook: s.facebook ?? "",
    serviceTypes: s.serviceTypes,
    staffCount: s.staffCount,
    submittedAt: (s.submittedAt ?? s.createdAt).toISOString(),
    // Whole days since it was sent, for the operator's queue.
    waitedDays: Math.floor((+now - +(s.submittedAt ?? s.createdAt)) / DAY),
    // Reviewed before: the owner corrected the details and sent them again.
    resubmitted: s.reviewedAt !== null,
    district: s.branches[0]?.district ?? "",
    address: s.branches[0]?.address ?? "",
    ownerName: s.members[0]?.user.name ?? "",
    ownerEmail: s.members[0]?.user.email ?? "",
  }));
}
export type PlatformApplication = Awaited<
  ReturnType<typeof listApplications>
>[number];
export const reviewInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }).strict(),
  z
    .object({
      decision: z.literal("REJECT"),
      note: z
        .string()
        .trim()
        .min(3, "Буцаах шалтгаанаа бичнэ үү.")
        .max(500, "Шалтгаан 500 тэмдэгтээс ихгүй байна."),
    })
    .strict(),
]);
// Approve a salon so the public can see it, or send it back with a reason the
// owner reads and corrects.
export async function reviewSalon(
  db: PrismaClient,
  adminUserId: string,
  salonId: string,
  raw: unknown,
  now = new Date(),
) {
  const input = reviewInput.parse(raw);
  return db.$transaction(async (tx) => {
    await assertPlatformAdmin(tx, adminUserId);
    const salon = await tx.salon.findUnique({
      where: { id: salonId },
      select: { reviewStatus: true, trialEndsAt: true },
    });
    if (!salon) throw new HttpError(404, platformNotFound);
    const reviewStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    if (salon.reviewStatus === reviewStatus && reviewStatus === "APPROVED")
      return { id: salonId, reviewStatus, approvedNow: false };
    await tx.salon.update({
      where: { id: salonId },
      data: {
        reviewStatus,
        reviewNote: input.decision === "REJECT" ? input.note : null,
        reviewedAt: now,
        // The free trial starts on approval, once per salon.
        ...(reviewStatus === "APPROVED" && !salon.trialEndsAt
          ? { trialEndsAt: trialEnd(now) }
          : {}),
      },
    });
    await tx.platformAuditLog.create({
      data: {
        actorUserId: adminUserId,
        salonId,
        action: input.decision === "APPROVE" ? "APPROVE_SALON" : "REJECT_SALON",
      },
    });
    return {
      id: salonId,
      reviewStatus,
      // Lets the caller greet the owner once, on the actual approval.
      approvedNow: reviewStatus === "APPROVED",
    };
  });
}
// Who to congratulate when a salon is approved: the address given at
// onboarding, else the first owner's.
export async function approvalRecipient(db: Database, salonId: string) {
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: {
      name: true,
      slug: true,
      email: true,
      trialEndsAt: true,
      members: {
        where: { role: "SALON_OWNER", active: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });
  return {
    to: salon.email || salon.members[0]?.user.email || "",
    salon: {
      name: salon.name,
      slug: salon.slug,
      trialEndsAt: salon.trialEndsAt,
    },
  };
}
