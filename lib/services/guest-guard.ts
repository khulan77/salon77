import type { Prisma } from "@prisma/client";
import { HttpError } from "../errors";
type Database = Prisma.TransactionClient;
// Upcoming unfinished online bookings one phone may hold per salon.
export const MAX_ACTIVE_PER_PHONE = 4;
export async function assertGuestQuota(
  db: Database,
  salonId: string,
  phone: string,
  adding: number,
  now = new Date(),
) {
  const active = await db.booking.count({
    where: {
      salonId,
      source: "ONLINE",
      customerPhoneSnapshot: phone,
      status: { in: ["PENDING", "CONFIRMED"] },
      endAt: { gt: now },
    },
  });
  if (active + adding > MAX_ACTIVE_PER_PHONE)
    throw new HttpError(
      429,
      "Энэ дугаараар хийсэн идэвхтэй захиалга олон байна. Салон руу залгаж холбогдоно уу.",
    );
}
// Lazily releases slots held by online bookings nobody confirmed in time.
export async function expireStalePending(
  db: Database,
  salonId: string,
  policy: { pendingExpiryMinutes: number },
  now = new Date(),
) {
  if (!policy.pendingExpiryMinutes) return 0;
  const { count } = await db.booking.updateMany({
    where: {
      salonId,
      source: "ONLINE",
      status: "PENDING",
      createdAt: { lt: new Date(+now - policy.pendingExpiryMinutes * 60000) },
    },
    data: { status: "CANCELLED", version: { increment: 1 } },
  });
  return count;
}
// Hidden form field that people never see; bots that fill it are rejected.
export function assertHuman(trap: string | undefined) {
  if (trap) throw new HttpError(400, "Захиалгыг хүлээн авах боломжгүй.");
}
