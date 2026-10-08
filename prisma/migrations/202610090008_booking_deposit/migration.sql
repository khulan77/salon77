-- Additive: deposits default to off, so existing salons and bookings are unchanged.
CREATE TYPE "DepositType" AS ENUM ('PERCENT', 'FIXED');
ALTER TABLE "BookingSettings"
  ADD COLUMN "depositRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositType" "DepositType" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN "depositValue" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "depositBankName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "depositAccountNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "depositAccountHolder" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_deposit_check" CHECK (
  "depositValue" BETWEEN 1 AND 1000000000
  AND ("depositType" <> 'PERCENT' OR "depositValue" <= 100)
  AND (NOT "depositRequired" OR ("depositBankName" <> '' AND "depositAccountNumber" <> '' AND "depositAccountHolder" <> '')));
-- The deposit requested when the booking was made (0 when none was required).
ALTER TABLE "Booking" ADD COLUMN "depositAmountSnapshot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deposit_check" CHECK (
  "depositAmountSnapshot" >= 0 AND "depositAmountSnapshot" <= "priceSnapshot");
