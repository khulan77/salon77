-- Additive: links bookings made together (two services, two staff, same start).
ALTER TABLE "Booking" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Booking_salonId_groupId_idx" ON "Booking"("salonId", "groupId");
