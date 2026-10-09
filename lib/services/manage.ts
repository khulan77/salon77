import { z } from "zod";
import type { Booking, PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { dateSchema } from "../booking-validation";
import { localStamp } from "../business-time";
import { enqueueNotice } from "../notifications/outbox";
import {
  bookingConflict,
  lockStaff,
  resolveContext,
  slots,
  transaction,
} from "./bookings";
import { hashManageToken } from "./visits";
import { recordActivity } from "./activity";
type Database = Parameters<typeof resolveContext>[0];
type Clock = { now?: () => Date };
// 32 random bytes in base64url.
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const notFound = "Захиалга олдсонгүй. Холбоосоо шалгана уу.";
export const manageAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), token: tokenSchema }).strict(),
  z
    .object({
      action: z.literal("reschedule"),
      token: tokenSchema,
      startAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);
async function load(db: Database, slug: string, rawToken: unknown) {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) throw new HttpError(404, notFound);
  const scope = await resolveContext(db, { slug });
  const bookings = await db.booking.findMany({
    where: {
      salonId: scope.salonId,
      manageTokenHash: hashManageToken(token.data),
    },
    orderBy: { idempotencyKey: "asc" },
  });
  if (!bookings.length) throw new HttpError(404, notFound);
  return { scope, bookings };
}
// Guests may act only on upcoming, unfinished visits before the salon's notice.
function state(bookings: Booking[], noticeMinutes: number, now: Date) {
  const start = bookings[0].startAt;
  const open = bookings.every((b) =>
    ["PENDING", "CONFIRMED"].includes(b.status),
  );
  const deadline = new Date(+start - noticeMinutes * 60000);
  return {
    status: bookings.some((b) => b.status === "CANCELLED")
      ? "CANCELLED"
      : open && start > now
        ? bookings.every((b) => b.status === "CONFIRMED")
          ? "CONFIRMED"
          : "PENDING"
        : "CLOSED",
    canChange: open && start > now && now <= deadline,
    deadline,
  };
}
async function contact(db: Database, b: Booking) {
  const [salon, branch] = await Promise.all([
    db.salon.findUniqueOrThrow({
      where: { id: b.salonId },
      select: { name: true, phone: true },
    }),
    db.branch.findUniqueOrThrow({
      where: { id: b.branchId },
      select: { name: true, address: true, phone: true },
    }),
  ]);
  return { salon, branch, phone: branch.phone || salon.phone };
}
export async function readManagedVisit(
  db: Database,
  slug: string,
  token: unknown,
  clock: Clock = {},
) {
  const now = clock.now?.() ?? new Date();
  const { scope, bookings } = await load(db, slug, token);
  const { salon, branch, phone } = await contact(db, bookings[0]);
  const staff = await db.staff.findMany({
    where: {
      salonId: scope.salonId,
      id: { in: bookings.map((b) => b.staffId) },
    },
    select: { id: true, name: true },
  });
  const s = state(bookings, scope.policy.cancellationNoticeMinutes, now);
  return {
    salonName: salon.name,
    phone,
    branchName: branch.name,
    branchAddress: branch.address,
    startAt: bookings[0].startAt.toISOString(),
    status: s.status,
    canChange: s.canChange,
    deadline: s.deadline.toISOString(),
    noticeMinutes: scope.policy.cancellationNoticeMinutes,
    totalMnt: bookings.reduce((sum, b) => sum + b.priceSnapshot, 0),
    items: bookings.map((b) => ({
      serviceName: b.serviceNameSnapshot,
      staffName: staff.find((p) => p.id === b.staffId)?.name ?? "",
      priceMnt: b.priceSnapshot,
      endAt: b.endAt.toISOString(),
    })),
  };
}
export type ManagedVisit = Awaited<ReturnType<typeof readManagedVisit>>;
// Start times where every booking of the visit fits with its own staff.
async function openTimes(
  db: Database,
  scope: Awaited<ReturnType<typeof resolveContext>>,
  bookings: Booking[],
  date: string,
  now?: Date,
) {
  const ids = bookings.map((b) => b.id);
  const lists: string[][] = [];
  for (const b of bookings) {
    const result = await slots(
      db,
      scope,
      {
        branchId: b.branchId,
        serviceId: b.serviceId,
        staffId: b.staffId,
        date,
      },
      { now, duration: b.durationMinutesSnapshot, excludeIds: ids },
    );
    lists.push(
      result.slots
        .filter((s) => s.staffIds.includes(b.staffId))
        .map((s) => s.startAt),
    );
  }
  return lists
    .reduce((common, times) => common.filter((t) => times.includes(t)))
    .sort();
}
export async function managedAvailability(
  db: Database,
  slug: string,
  raw: { token: unknown; date: unknown },
  clock: Clock = {},
) {
  const date = dateSchema.parse(raw.date);
  const now = clock.now?.() ?? new Date();
  const { scope, bookings } = await load(db, slug, raw.token);
  if (!state(bookings, scope.policy.cancellationNoticeMinutes, now).canChange)
    return { slots: [] };
  const times = await openTimes(db, scope, bookings, date, now);
  return { slots: times.map((startAt) => ({ startAt })) };
}
function tooLate(phone: string) {
  return new HttpError(
    409,
    `Онлайнаар цуцлах, өөрчлөх хугацаа өнгөрсөн. Салон руу залгана уу: ${phone}`,
  );
}
export async function changeManagedVisit(
  db: PrismaClient,
  slug: string,
  raw: unknown,
  clock: Clock = {},
): Promise<Booking[]> {
  const input = manageAction.parse(raw);
  return transaction(db, async (tx) => {
    const now = clock.now?.() ?? new Date();
    const { scope, bookings } = await load(tx, slug, input.token);
    const s = state(bookings, scope.policy.cancellationNoticeMinutes, now);
    if (!s.canChange) {
      if (s.status === "CANCELLED")
        throw new HttpError(409, "Энэ захиалга аль хэдийн цуцлагдсан байна.");
      throw tooLate((await contact(tx, bookings[0])).phone);
    }
    await lockStaff(
      tx,
      bookings.map((b) => b.staffId),
    );
    if (input.action === "cancel") {
      const cancelled: Booking[] = [];
      for (const b of bookings)
        cancelled.push(
          await tx.booking.update({
            where: { id: b.id },
            data: { status: "CANCELLED", version: { increment: 1 } },
          }),
        );
      await recordActivity(tx, cancelled[0], "CUSTOMER_CANCELLED");
      await enqueueNotice(tx, cancelled, "BOOKING_CANCELLED");
      return cancelled;
    }
    const startAt = new Date(input.startAt);
    const date = localStamp(startAt).slice(0, 10);
    const times = await openTimes(tx, scope, bookings, date, now);
    if (!times.includes(startAt.toISOString()))
      throw new HttpError(409, bookingConflict);
    const moved: Booking[] = [];
    for (const b of bookings)
      moved.push(
        await tx.booking.update({
          where: { id: b.id },
          data: {
            startAt,
            endAt: new Date(+startAt + b.durationMinutesSnapshot * 60000),
            version: { increment: 1 },
          },
        }),
      );
    await recordActivity(tx, moved[0], "CUSTOMER_RESCHEDULED");
    await enqueueNotice(tx, moved, "BOOKING_RESCHEDULED");
    return moved;
  });
}
