-- Past confirmed bookings count as completed unless the salon opts out.
ALTER TABLE "BookingSettings" ADD COLUMN "autoCompletePast" BOOLEAN NOT NULL DEFAULT true;
