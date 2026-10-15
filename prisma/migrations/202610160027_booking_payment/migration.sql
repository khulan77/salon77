-- Desk bookings may add an extra charge and record how the customer paid.
CREATE TYPE "PaymentMethod" AS ENUM ('POS', 'TRANSFER', 'CASH');
ALTER TABLE "Booking"
  ADD COLUMN "extraMnt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD CONSTRAINT "Booking_extraMnt_check" CHECK ("extraMnt" BETWEEN 0 AND 100000000);
