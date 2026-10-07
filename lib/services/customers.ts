import type { PrismaClient, Prisma } from "@prisma/client";
import { bookingScope, bookingView } from "./bookings";
import { type Actor, refreshActor, requireOwner } from "../access";
import { customerInput } from "../booking-validation";
import { HttpError } from "../errors";
import { z } from "zod";
function scope(actor: Actor): Prisma.CustomerWhereInput {
  const booking = bookingScope(actor);
  return {
    salonId: actor.salonId,
    ...(actor.role === "SALON_OWNER" ? {} : { bookings: { some: booking } }),
  };
}
export async function listCustomers(
  db: PrismaClient,
  actor: Actor,
  search = "",
  page = 0,
) {
  const compact = search.replace(/[\s().-]/g, "");
  const where = {
    ...scope(actor),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: compact || search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      select: { id: true, name: true, phone: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: page * 30,
      take: 30,
    }),
    db.customer.count({ where }),
  ]);
  const filter = {
    ...bookingScope(actor),
    customerId: { in: rows.map((c) => c.id) },
  };
  const [counts, last, next] = await Promise.all([
    db.booking.groupBy({
      by: ["customerId"],
      where: filter,
      _count: { _all: true },
    }),
    db.booking.groupBy({
      by: ["customerId"],
      where: { ...filter, status: "COMPLETED", endAt: { lte: new Date() } },
      _max: { endAt: true },
    }),
    db.booking.groupBy({
      by: ["customerId"],
      where: {
        ...filter,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gte: new Date() },
      },
      _min: { startAt: true },
    }),
  ]);
  return {
    total,
    customers: rows.map((c) => ({
      ...c,
      totalBookings:
        counts.find((x) => x.customerId === c.id)?._count._all ?? 0,
      lastVisit:
        last.find((x) => x.customerId === c.id)?._max.endAt?.toISOString() ??
        null,
      upcoming:
        next.find((x) => x.customerId === c.id)?._min.startAt?.toISOString() ??
        null,
    })),
  };
}
export async function customerDetail(
  db: PrismaClient,
  actor: Actor,
  id: string,
  page = 0,
) {
  const customer = await db.customer.findFirst({
    where: { ...scope(actor), id },
  });
  if (!customer) throw new HttpError(404, "Үйлчлүүлэгч олдсонгүй.");
  const where = { ...bookingScope(actor), customerId: id };
  const [history, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      skip: page * 30,
      take: 30,
    }),
    db.booking.count({ where }),
  ]);
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      notes: actor.role === "SALON_OWNER" ? (customer.notes ?? "") : "",
    },
    history: history.map(bookingView),
    total,
  };
}
export async function updateCustomer(
  db: PrismaClient,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const input = customerInput
    .extend({ notes: z.string().trim().max(2000) })
    .strict()
    .parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const result = await tx.customer.updateMany({
      where: { id, salonId: current.salonId },
      data: { ...input, email: input.email || null },
    });
    if (!result.count) throw new HttpError(404, "Үйлчлүүлэгч олдсонгүй.");
    return { success: true };
  });
}
