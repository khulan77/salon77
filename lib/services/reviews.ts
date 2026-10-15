import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { type Actor, refreshActor } from "../access";
import { canReview, loadManaged } from "./manage";
import { transaction } from "./bookings";
type Database = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export const reviewInput = z
  .object({
    token: z.string().min(1).max(100),
    rating: z
      .number({ message: "Үнэлгээгээ одоор сонгоно уу." })
      .int()
      .min(1, "Үнэлгээгээ одоор сонгоно уу.")
      .max(5),
    comment: z
      .string()
      .trim()
      .max(1000, "Сэтгэгдэл 1000 тэмдэгтээс ихгүй байна.")
      .default(""),
  })
  .strict();
// A guest rates a finished visit from their private link, once.
export async function submitReview(
  db: PrismaClient,
  slug: string,
  raw: unknown,
  now = new Date(),
) {
  const input = reviewInput.parse(raw);
  return transaction(db, async (tx) => {
    const { scope, bookings } = await loadManaged(tx, slug, input.token);
    if (!canReview(bookings, now))
      throw new HttpError(409, "Үйлчилгээ авсны дараа үнэлгээ өгөх боломжтой.");
    const first = bookings[0];
    if (await tx.review.findUnique({ where: { bookingId: first.id } }))
      throw new HttpError(409, "Та энэ үйлчилгээнд аль хэдийн үнэлгээ өгсөн.");
    return tx.review.create({
      data: {
        salonId: scope.salonId,
        bookingId: first.id,
        rating: input.rating,
        comment: input.comment || null,
        // Only the first name is shown publicly.
        customerName:
          first.customerNameSnapshot.trim().split(/\s+/)[0]?.slice(0, 100) ||
          "Үйлчлүүлэгч",
      },
      select: { rating: true, comment: true },
    });
  });
}
// The booking page's summary: average, count and the latest comments.
export async function publicReviews(db: Database, salonId: string) {
  const where = { salonId, hidden: false };
  const [summary, latest] = await Promise.all([
    db.review.aggregate({
      where,
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: { ...where, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        rating: true,
        comment: true,
        customerName: true,
        createdAt: true,
        booking: { select: { serviceNameSnapshot: true } },
      },
    }),
  ]);
  return {
    average: summary._avg.rating
      ? Math.round(summary._avg.rating * 10) / 10
      : null,
    count: summary._count._all,
    latest: latest.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? "",
      customerName: r.customerName,
      serviceName: r.booking.serviceNameSnapshot,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
const reviewRoles = ["SALON_OWNER", "MANAGER"];
// All reviews for the salon team, hidden ones included.
export async function listReviews(db: PrismaClient, actor: Actor) {
  const current = await refreshActor(db, actor);
  if (!reviewRoles.includes(current.role))
    throw new HttpError(403, "Сэтгэгдэл харах эрхгүй байна.");
  const rows = await db.review.findMany({
    where: { salonId: current.salonId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      rating: true,
      comment: true,
      customerName: true,
      hidden: true,
      createdAt: true,
      booking: {
        select: {
          serviceNameSnapshot: true,
          customerPhoneSnapshot: true,
          staff: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment ?? "",
    customerName: r.customerName,
    hidden: r.hidden,
    createdAt: r.createdAt.toISOString(),
    serviceName: r.booking.serviceNameSnapshot,
    staffName: r.booking.staff.name,
    customerPhone: r.booking.customerPhoneSnapshot,
  }));
}
export type ReviewList = Awaited<ReturnType<typeof listReviews>>;
export const reviewVisibility = z.object({ hidden: z.boolean() }).strict();
// Owners may hide a review from the booking page; it is never deleted.
export async function setReviewHidden(
  db: PrismaClient,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const { hidden } = reviewVisibility.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    if (current.role !== "SALON_OWNER")
      throw new HttpError(403, "Зөвхөн эзэмшигч сэтгэгдлийг нууна.");
    const result = await tx.review.updateMany({
      where: { id, salonId: current.salonId },
      data: { hidden },
    });
    if (!result.count) throw new HttpError(404, "Сэтгэгдэл олдсонгүй.");
    return { id, hidden };
  });
}
// Average rating per staff member, from the bookings their reviews are on.
export async function staffRatings(db: Database, salonId: string) {
  const rows = await db.$queryRaw<
    { staffId: string; average: number; count: bigint }[]
  >`
    SELECT b."staffId" AS "staffId", avg(r."rating")::float AS average, count(*) AS count
    FROM "Review" r
    JOIN "Booking" b ON b."id" = r."bookingId" AND b."salonId" = r."salonId"
    WHERE r."salonId" = ${salonId} AND r."hidden" = false
    GROUP BY b."staffId"`;
  return rows.map((r) => ({
    staffId: r.staffId,
    average: Math.round(r.average * 10) / 10,
    count: Number(r.count),
  }));
}
