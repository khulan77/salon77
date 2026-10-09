import type { Booking, NotificationEvent, Prisma } from "@prisma/client";
import { salonBookingPolicy } from "../services/booking-settings";
import { renderNotice } from "./templates";
type Database = Prisma.TransactionClient;
// Called inside the booking transaction, so a notice exists iff the change does.
// Bookings of one visit produce a single combined message.
export async function enqueueNotice(
  db: Database,
  bookings: Booking[],
  event: NotificationEvent,
  extra: { manageUrl?: string } = {},
) {
  const first = bookings[0];
  if (!first) return;
  const policy = await salonBookingPolicy(db, first.salonId);
  if (!policy.notificationsEnabled) return;
  const [salon, branch] = await Promise.all([
    db.salon.findUniqueOrThrow({
      where: { id: first.salonId },
      select: { name: true, phone: true },
    }),
    db.branch.findUniqueOrThrow({
      where: { id: first.branchId },
      select: { name: true, phone: true },
    }),
  ]);
  const deposit = bookings.reduce((sum, b) => sum + b.depositAmountSnapshot, 0);
  const body = renderNotice(event, {
    salonName: salon.name,
    branchName: branch.name,
    salonPhone: branch.phone || salon.phone,
    services: bookings.map((b) => b.serviceNameSnapshot),
    startAt: first.startAt,
    manageUrl: extra.manageUrl,
    deposit:
      deposit > 0
        ? {
            amountMnt: deposit,
            bankName: policy.depositBankName,
            accountNumber: policy.depositAccountNumber,
          }
        : undefined,
  });
  // The version makes repeated changes distinct while retries stay deduplicated.
  const subject = first.groupId ?? first.id;
  await db.notification.createMany({
    data: [
      {
        salonId: first.salonId,
        bookingId: first.id,
        event,
        recipient: first.customerPhoneSnapshot,
        body,
        dedupeKey: `${event}:${subject}:${first.version}`,
      },
    ],
    skipDuplicates: true,
  });
  if (event === "BOOKING_CANCELLED") await cancelReminders(db, bookings);
  else
    await scheduleReminders(db, bookings, policy.reminderMinutes, {
      salonName: salon.name,
      branchName: branch.name,
      salonPhone: branch.phone || salon.phone,
      services: bookings.map((b) => b.serviceNameSnapshot),
      startAt: first.startAt,
    });
}
// Withdraw reminders that have not gone out yet (cancel or reschedule).
export async function cancelReminders(db: Database, bookings: Booking[]) {
  await db.notification.updateMany({
    where: {
      salonId: bookings[0]?.salonId,
      bookingId: { in: bookings.map((b) => b.id) },
      event: "BOOKING_REMINDER",
      status: "PENDING",
    },
    data: { status: "SKIPPED", lastError: reminderWithdrawn },
  });
}
export const reminderWithdrawn = "Захиалга өөрчлөгдсөн тул сануулга хэрэггүй.";
// One reminder per lead time, due at start minus the lead time. Keyed by the
// start instant, so confirming keeps them and rescheduling replaces them.
async function scheduleReminders(
  db: Database,
  bookings: Booking[],
  minutes: number[],
  data: Parameters<typeof renderNotice>[1],
  now = new Date(),
) {
  const first = bookings[0];
  const subject = first.groupId ?? first.id;
  const stamp = first.startAt.toISOString();
  await db.notification.updateMany({
    where: {
      salonId: first.salonId,
      bookingId: { in: bookings.map((b) => b.id) },
      event: "BOOKING_REMINDER",
      status: "PENDING",
      NOT: { dedupeKey: { endsWith: `:${stamp}` } },
    },
    data: { status: "SKIPPED", lastError: reminderWithdrawn },
  });
  const due = minutes
    .map((m) => ({ m, at: new Date(+first.startAt - m * 60000) }))
    .filter(({ at }) => at > now);
  if (!due.length) return;
  await db.notification.createMany({
    data: due.map(({ m, at }) => ({
      salonId: first.salonId,
      bookingId: first.id,
      event: "BOOKING_REMINDER" as const,
      recipient: first.customerPhoneSnapshot,
      body: renderNotice("BOOKING_REMINDER", data),
      availableAt: at,
      dedupeKey: `BOOKING_REMINDER:${m}:${subject}:${stamp}`,
    })),
    skipDuplicates: true,
  });
}
