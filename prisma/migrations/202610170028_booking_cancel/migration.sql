-- Record when and by whom a booking was cancelled.
CREATE TYPE "CancelSource" AS ENUM ('STAFF', 'CUSTOMER', 'EXPIRED');
ALTER TABLE "Booking"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelSource" "CancelSource",
  ADD COLUMN "cancelledByMemberId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancelledByMemberId_salonId_fkey" FOREIGN KEY ("cancelledByMemberId", "salonId") REFERENCES "SalonMember"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;
