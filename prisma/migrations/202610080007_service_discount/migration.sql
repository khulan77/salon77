-- Additive: existing services default to no discount; existing bookings keep their prices.
ALTER TABLE "Service" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD CONSTRAINT "Service_discount_check" CHECK ("discountPercent" BETWEEN 0 AND 90);
-- priceSnapshot stays the price actually charged; this records the discount applied.
ALTER TABLE "Booking" ADD COLUMN "discountPercentSnapshot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_discount_check" CHECK ("discountPercentSnapshot" BETWEEN 0 AND 90);
