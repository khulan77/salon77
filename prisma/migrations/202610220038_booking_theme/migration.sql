CREATE TYPE "BookingTheme" AS ENUM ('LIGHT', 'DARK', 'PINK', 'NATURAL', 'GOLD');
ALTER TABLE "BookingSettings" ADD COLUMN "bookingTheme" "BookingTheme" NOT NULL DEFAULT 'LIGHT';
