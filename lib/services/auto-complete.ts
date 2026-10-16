import type { Prisma } from "@prisma/client";
type Database = Prisma.TransactionClient;
// Salons rarely press "Дууссан"; a confirmed visit whose time has passed
// counts as done unless the salon turned this off. Omit salonId to sweep all.
export async function completePastBookings(
  db: Database,
  salonId?: string,
  now = new Date(),
) {
  const { count } = await db.booking.updateMany({
    where: {
      ...(salonId ? { salonId } : {}),
      status: "CONFIRMED",
      endAt: { lte: now },
      salon: {
        OR: [
          { bookingSettings: null },
          { bookingSettings: { autoCompletePast: true } },
        ],
      },
    },
    data: { status: "COMPLETED", version: { increment: 1 } },
  });
  return count;
}
