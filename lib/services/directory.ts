import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { discountedPrice } from "../pricing";
type Database = Prisma.TransactionClient;
export const directoryQuery = z
  .object({
    query: z.string().trim().max(100).default(""),
    district: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();
const PAGE = 24;
// Services a guest could actually book online right now.
const bookable: Prisma.ServiceWhereInput = {
  active: true,
  onlineBookable: true,
  category: { active: true },
  branches: { some: { branch: { active: true } } },
};
// Only active, publicly bookable salons that did not opt out are listed.
const listed: Prisma.SalonWhereInput = {
  status: "ACTIVE",
  bookingSettings: { publicBookingEnabled: true, listedInDirectory: true },
  services: { some: bookable },
};
export async function listDirectory(db: Database, raw: unknown) {
  const input = directoryQuery.parse(raw);
  const where: Prisma.SalonWhereInput = {
    ...listed,
    AND: [
      input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              {
                services: {
                  some: {
                    ...bookable,
                    name: { contains: input.query, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {},
      input.district
        ? { branches: { some: { active: true, district: input.district } } }
        : {},
    ],
  };
  const [total, salons, districts] = await Promise.all([
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
        branches: {
          where: { active: true },
          select: { district: true, address: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.branch.findMany({
      where: { active: true, salon: listed },
      distinct: ["district"],
      select: { district: true },
      orderBy: { district: "asc" },
    }),
  ]);
  const services = await db.service.findMany({
    where: { ...bookable, salonId: { in: salons.map((s) => s.id) } },
    select: { salonId: true, priceMnt: true, discountPercent: true },
  });
  return {
    ...input,
    total,
    pageSize: PAGE,
    districts: districts.map((d) => d.district).filter(Boolean),
    salons: salons.map((s) => {
      const own = services.filter((v) => v.salonId === s.id);
      const prices = own.map((v) =>
        discountedPrice(v.priceMnt, v.discountPercent),
      );
      return {
        name: s.name,
        slug: s.slug,
        coverUrl: s.coverUrl,
        description: s.description ?? "",
        district: s.branches[0]?.district ?? "",
        address: s.branches[0]?.address ?? "",
        branches: s.branches.length,
        services: own.length,
        fromMnt: prices.length ? Math.min(...prices) : 0,
        hasDiscount: own.some((v) => v.discountPercent > 0),
      };
    }),
  };
}
export type Directory = Awaited<ReturnType<typeof listDirectory>>;
