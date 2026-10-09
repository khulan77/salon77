-- Additive. SHA-256 of the guest's private manage-link token; the bookings of
-- one visit share it. Null for bookings made by staff or before this change.
ALTER TABLE "Booking" ADD COLUMN "manageTokenHash" TEXT;
CREATE INDEX "Booking_manageTokenHash_idx" ON "Booking"("manageTokenHash");
