-- CreateEnum
CREATE TYPE "BookingConfirmationMode" AS ENUM ('AUTO_CONFIRM', 'MANUAL_CONFIRM');

-- CreateTable
CREATE TABLE "BookingSettings" (
    "salonId" TEXT NOT NULL,
    "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bookingConfirmationMode" "BookingConfirmationMode" NOT NULL DEFAULT 'MANUAL_CONFIRM',
    "advanceBookingDays" INTEGER NOT NULL DEFAULT 365,
    "minimumBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
    "cancellationNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("salonId")
);

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_policy_bounds" CHECK (
 "advanceBookingDays" BETWEEN 0 AND 365
 AND "minimumBookingNoticeMinutes" BETWEEN 0 AND 525600
 AND "cancellationNoticeMinutes" BETWEEN 0 AND 525600
 AND "slotIntervalMinutes" IN (15,30));
-- Backfill existing tenants without touching appointments or previous migrations.
INSERT INTO "BookingSettings" ("salonId") SELECT id FROM "Salon";
-- Keep the one-to-one default present for every future salon, including onboarding.
CREATE FUNCTION salon77_default_booking_settings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "BookingSettings" ("salonId") VALUES (NEW.id);
 RETURN NEW;
END;
$$;
CREATE TRIGGER "Salon_default_booking_settings" AFTER INSERT ON "Salon"
 FOR EACH ROW EXECUTE FUNCTION salon77_default_booking_settings();
ALTER TABLE "BookingSettings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BookingSettings" FROM anon, authenticated;
