import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { discountedPrice } from "../pricing";
import { localStamp } from "../business-time";
import { DISTRICTS, normalizeDistrict } from "../districts";
type Database = Prisma.TransactionClient;
export const directoryQuery = z
  .object({
    query: z.string().trim().max(100).default(""),
    district: z.union([z.enum(DISTRICTS), z.literal("")]).default(""),
    page: z.coerce.number().int().min(0).max(1000).default(0),
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
// Only approved, active, publicly bookable salons that did not opt out are listed.
const listed: Prisma.SalonWhereInput = {
  status: "ACTIVE",
  reviewStatus: "APPROVED",
  bookingSettings: { publicBookingEnabled: true, listedInDirectory: true },
  services: { some: bookable },
};
// Below this many listed salons, signed-out visitors to "/" see the business
// page instead of a near-empty directory. DIRECTORY_MIN_SALONS overrides it.
export function directoryThreshold(raw = process.env.DIRECTORY_MIN_SALONS) {
  const value = Number(raw);
  return raw?.trim() && Number.isInteger(value) && value >= 0 ? value : 5;
}
export function listedSalonCount(db: Database) {
  return db.salon.count({ where: listed });
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
  const stored = (
    await db.branch.findMany({
      where: { active: true, salon: listed },
      distinct: ["district"],
      select: { district: true },
    })
  ).map((b) => b.district);
  const spellings = (district: string) =>
    stored.filter((v) => normalizeDistrict(v) === district);
  const where: Prisma.SalonWhereInput = {
    ...listed,
    AND: [
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
            select: { district: true, address: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.salon.count({ where: listed }),
      db.service.findMany({
        where: { ...bookable, salon: listed },
        select: { category: { select: { name: true } } },
        take: 2000,
      }),
      db.booking.count({
        where: { source: "ONLINE", createdAt: { gte: today }, salon: listed },
      }),
    ]);
  const services = await db.service.findMany({
    where: { ...bookable, salonId: { in: salons.map((s) => s.id) } },
    select: {
      salonId: true,
      priceMnt: true,
      discountPercent: true,
      category: { select: { name: true } },
    },
  });
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
        // The cover leads; without one, the first gallery photo stands in.
        coverUrl: s.coverUrl ?? s.images[0]?.url ?? null,
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
        isNew: +now - +s.createdAt < NEW_DAYS * 86400000,
      };
    }),
  };
}
export type Directory = Awaited<ReturnType<typeof listDirectory>>;
