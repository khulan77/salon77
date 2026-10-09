import type {
  Booking,
  BookingActivityType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { type Actor, refreshActor } from "../access";
import { HttpError } from "../errors";
type Database = Prisma.TransactionClient;
// Called inside the booking transaction; one row per visit (its first booking).
export async function recordActivity(
  db: Database,
  booking: Pick<Booking, "id" | "salonId" | "branchId">,
  type: BookingActivityType,
) {
  await db.bookingActivity.create({
    data: {
      salonId: booking.salonId,
      branchId: booking.branchId,
      bookingId: booking.id,
      type,
    },
  });
}
function requireFrontDesk(actor: Actor) {
  if (!["SALON_OWNER", "MANAGER", "RECEPTIONIST"].includes(actor.role))
    throw new HttpError(403, "Мэдэгдэл харах эрхгүй байна.");
}
const branchFilter = (actor: Actor) =>
  actor.role === "SALON_OWNER" ? {} : { branchId: { in: actor.branchIds } };
export async function readInbox(
  db: PrismaClient,
  actor: Actor,
  now = new Date(),
) {
  const current = await refreshActor(db, actor);
  requireFrontDesk(current);
  const member = await db.salonMember.findUniqueOrThrow({
    where: { id: current.id },
    select: { activitySeenAt: true },
  });
  const scope = { salonId: current.salonId, ...branchFilter(current) };
  const [pending, unread, rows] = await Promise.all([
    db.booking.count({
      where: { ...scope, status: "PENDING", startAt: { gt: now } },
    }),
    db.bookingActivity.count({
      where: {
        ...scope,
        ...(member.activitySeenAt
          ? { createdAt: { gt: member.activitySeenAt } }
          : {}),
      },
    }),
    db.bookingActivity.findMany({
      where: scope,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        type: true,
        createdAt: true,
        branch: { select: { name: true } },
        booking: {
          select: {
            startAt: true,
            status: true,
            customerNameSnapshot: true,
            serviceNameSnapshot: true,
            groupId: true,
          },
        },
      },
    }),
  ]);
  return {
    pending,
    unread,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      unread: !member.activitySeenAt || r.createdAt > member.activitySeenAt,
      branchName: r.branch.name,
      customerName: r.booking.customerNameSnapshot,
      serviceName: r.booking.serviceNameSnapshot,
      startAt: r.booking.startAt.toISOString(),
      status: r.booking.status,
      multi: Boolean(r.booking.groupId),
    })),
  };
}
export type Inbox = Awaited<ReturnType<typeof readInbox>>;
export async function markInboxSeen(
  db: PrismaClient,
  actor: Actor,
  now = new Date(),
) {
  const current = await refreshActor(db, actor);
  requireFrontDesk(current);
  await db.salonMember.update({
    where: { id: current.id },
    data: { activitySeenAt: now },
  });
  return { success: true };
}
