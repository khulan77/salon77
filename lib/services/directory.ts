import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { discountedPrice } from "../pricing";
import { localStamp } from "../business-time";
import { DISTRICTS, normalizeDistrict } from "../districts";
import { paidUp } from "../billing";
import { profileReady } from "./publish";
import { clockTime } from "../schedule-time";
type Database = Prisma.TransactionClient;
export const directoryQuery = z
  .object({
    query: z.string().trim().max(100).default(""),
    district: z.union([z.enum(DISTRICTS), z.literal("")]).default(""),
    page: z.coerce.number().int().min(0).max(1000).default(0),
    // Quick filters above the salon grid.
    filter: z.enum(["", "discount", "new"]).default(""),
  })
  .strict();
const PAGE = 24;
const NEW_DAYS = 30;
// Services a guest could actually book online right now.
const bookable: Prisma.ServiceWhereInput = {
  active: true,
  onlineBookable: true,
  category: { active: true },
  branches: { some: { branch: { active: true } } },
};
// Only approved, active, paid-up, publicly bookable salons with a complete
// profile (see publish.ts) that did not opt out are listed.
const listed = (now = new Date()): Prisma.SalonWhereInput => ({
  status: "ACTIVE",
  ...paidUp(now),
  reviewStatus: "APPROVED",
  bookingSettings: { publicBookingEnabled: true, listedInDirectory: true },
  services: { some: bookable },
  ...profileReady,
});
// Below this many listed salons, signed-out visitors to "/" see the business
// page instead of a near-empty directory. DIRECTORY_MIN_SALONS overrides it.
export function directoryThreshold(raw = process.env.DIRECTORY_MIN_SALONS) {
  const value = Number(raw);
  return raw?.trim() && Number.isInteger(value) && value >= 0 ? value : 5;
}
// Booking pages worth indexing: the same salons the directory lists.
export function listedSalonSlugs(db: Database) {
  return db.salon.findMany({
    where: listed(),
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
}
export function listedSalonCount(db: Database) {
  return db.salon.count({ where: listed() });
}
// The root page asks on every signed-out visit, so the count is reused for a
// minute instead of hitting the database each time.
const COUNT_TTL_MS = 60_000;
let countCache: { at: number; value: Promise<number> } | null = null;
export async function showDirectory(
  db: Database,
  threshold = directoryThreshold(),
  now = Date.now(),
) {
  if (!countCache || now - countCache.at >= COUNT_TTL_MS) {
    const value = listedSalonCount(db);
    countCache = { at: now, value };
    // A failed count is not kept, so the next visit asks again.
    value.catch(() => {
      if (countCache?.value === value) countCache = null;
    });
  }
  return (await countCache.value) >= threshold;
}
export async function listDirectory(
  db: Database,
  raw: unknown,
  now = new Date(),
) {
  const input = directoryQuery.parse(raw);
  const text = { contains: input.query, mode: "insensitive" as const };
  // Older branches may still hold a free-text spelling ("СБД"); each one
  // counts under its standard district.
  const listedBranches = await db.branch.findMany({
    where: { active: true, salon: listed(now) },
    select: { district: true, salonId: true },
    take: 5000,
  });
  const stored = [...new Set(listedBranches.map((b) => b.district))];
  const spellings = (district: string) =>
    stored.filter((v) => normalizeDistrict(v) === district);
  const where: Prisma.SalonWhereInput = {
    // Nested so the profile rule's own AND is never overwritten.
    AND: [
      listed(now),
      input.query
        ? {
            OR: [
              { name: text },
              // A service or its category ("Хумс", "Үс") matches too.
              {
                services: {
                  some: {
                    ...bookable,
                    OR: [{ name: text }, { category: { name: text } }],
                  },
                },
              },
            ],
          }
        : {},
      input.district
        ? {
            branches: {
              some: {
                active: true,
                district: { in: spellings(input.district) },
              },
            },
          }
        : {},
      input.filter === "discount"
        ? { services: { some: { ...bookable, discountPercent: { gt: 0 } } } }
        : input.filter === "new"
          ? { createdAt: { gte: new Date(+now - NEW_DAYS * 86400000) } }
          : {},
    ],
  };
  const today = new Date(`${localStamp(now).slice(0, 10)}T00:00:00+08:00`);
  const [total, salons, allSalons, allServices, bookingsToday] =
    await Promise.all([
      db.salon.count({ where }),
      db.salon.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: input.page * PAGE,
        take: PAGE,
        // Explicit public fields only: no members, staff, customers or settings.
        select: {
          id: true,
          name: true,
          slug: true,
          coverUrl: true,
          description: true,
          createdAt: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { url: true },
            take: 10,
          },
          branches: {
            where: { active: true },
            select: {
              district: true,
              address: true,
              imageUrl: true,
              openMinute: true,
              closeMinute: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.salon.count({ where: listed(now) }),
      db.service.findMany({
        where: { ...bookable, salon: listed(now) },
        select: { salonId: true, category: { select: { name: true } } },
        take: 2000,
      }),
      db.booking.count({
        where: {
          source: "ONLINE",
          createdAt: { gte: today },
          salon: listed(now),
        },
      }),
    ]);
  const ids = salons.map((s) => s.id);
  const [services, ratings] = await Promise.all([
    db.service.findMany({
      where: { ...bookable, salonId: { in: ids } },
      select: {
        salonId: true,
        name: true,
        priceMnt: true,
        discountPercent: true,
        durationMinutes: true,
        category: { select: { name: true } },
      },
      orderBy: [{ priceMnt: "asc" }, { name: "asc" }],
    }),
    // Published reviews only, as on the booking page.
    db.review.groupBy({
      by: ["salonId"],
      where: { salonId: { in: ids }, hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  // How many listed salons offer each category, and sit in each district.
  const salonsPer = (pairs: [string, string][]) => {
    const sets = new Map<string, Set<string>>();
    for (const [key, salon] of pairs)
      (sets.get(key) ?? sets.set(key, new Set()).get(key)!).add(salon);
    return [...sets.entries()]
      .map(([name, set]) => ({ name, salons: set.size }))
      .sort((a, b) => b.salons - a.salons || a.name.localeCompare(b.name));
  };
  // Category names repeat across salons; rank them for the quick filters.
  const byCategory = new Map<string, number>();
  for (const s of allServices)
    byCategory.set(s.category.name, (byCategory.get(s.category.name) ?? 0) + 1);
  return {
    ...input,
    total,
    pageSize: PAGE,
    districts: DISTRICTS.filter((d) => spellings(d).length),
    stats: {
      salons: allSalons,
      services: allServices.length,
      bookingsToday,
    },
    categories: salonsPer(
      allServices.map((s) => [s.category.name, s.salonId]),
    ).slice(0, 8),
    areas: salonsPer(
      listedBranches.map((b) => [
        normalizeDistrict(b.district) ?? b.district,
        b.salonId,
      ]),
    ),
    popular: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name]) => name),
    salons: salons.map((s) => {
      const own = services.filter((v) => v.salonId === s.id);
      const prices = own.map((v) =>
        discountedPrice(v.priceMnt, v.discountPercent),
      );
      return {
        name: s.name,
        slug: s.slug,
        // The first branch photo leads, then the salon cover, then the
        // first work photo.
        coverUrl:
          s.branches.find((b) => b.imageUrl)?.imageUrl ??
          s.coverUrl ??
          s.images[0]?.url ??
          null,
        photos: s.images.length + (s.coverUrl ? 1 : 0),
        description: s.description ?? "",
        district: s.branches[0]
          ? (normalizeDistrict(s.branches[0].district) ??
            s.branches[0].district)
          : "",
        address: s.branches[0]?.address ?? "",
        branches: s.branches.length,
        services: own.length,
        categories: [...new Set(own.map((v) => v.category.name))].slice(0, 3),
        fromMnt: prices.length ? Math.min(...prices) : 0,
        hasDiscount: own.some((v) => v.discountPercent > 0),
        rating: (() => {
          const r = ratings.find((x) => x.salonId === s.id);
          return r && r._count._all > 0
            ? { average: r._avg.rating ?? 0, count: r._count._all }
            : null;
        })(),
        // The two lowest-priced services, as a taste of the menu.
        top: own.slice(0, 2).map((v) => ({
          name: v.name,
          durationMinutes: v.durationMinutes,
          priceMnt: discountedPrice(v.priceMnt, v.discountPercent),
          listPriceMnt: v.priceMnt,
        })),
        hours: s.branches[0]
          ? `${clockTime(s.branches[0].openMinute)}–${clockTime(s.branches[0].closeMinute)}`
          : "",
        isNew: +now - +s.createdAt < NEW_DAYS * 86400000,
      };
    }),
  };
}
export type Directory = Awaited<ReturnType<typeof listDirectory>>;
