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
}
