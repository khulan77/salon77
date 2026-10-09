-- Operational feed for the admin bell. Written in the same transaction as the
-- booking change; additive.
CREATE TYPE "BookingActivityType" AS ENUM ('ONLINE_CREATED', 'CUSTOMER_CANCELLED', 'CUSTOMER_RESCHEDULED', 'EXPIRED');
CREATE TABLE "BookingActivity" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingActivity_salonId_createdAt_idx" ON "BookingActivity"("salonId", "createdAt");
ALTER TABLE "BookingActivity" ADD CONSTRAINT "BookingActivity_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingActivity" ADD CONSTRAINT "BookingActivity_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingActivity" ADD CONSTRAINT "BookingActivity_bookingId_salonId_fkey" FOREIGN KEY ("bookingId", "salonId") REFERENCES "Booking"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingActivity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BookingActivity" FROM anon, authenticated;
-- When each member last opened the bell (unread = newer activity).
ALTER TABLE "SalonMember" ADD COLUMN "activitySeenAt" TIMESTAMP(3);
