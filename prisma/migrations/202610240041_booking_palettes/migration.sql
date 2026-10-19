-- Booking pages share the admin design; the themes are now colour palettes.
ALTER TYPE "BookingTheme" RENAME VALUE 'LIGHT' TO 'CLASSIC';
ALTER TYPE "BookingTheme" RENAME VALUE 'NATURAL' TO 'GREEN';
ALTER TYPE "BookingTheme" RENAME VALUE 'PINK' TO 'ROSE';
ALTER TYPE "BookingTheme" RENAME VALUE 'DARK' TO 'VIOLET';
ALTER TYPE "BookingTheme" RENAME VALUE 'GOLD' TO 'BLUE';

-- The dark and gold pages were closest to black and gold, not to the new
-- violet and blue palettes.
UPDATE "BookingSettings" SET "bookingTheme" = 'CLASSIC'
WHERE "bookingTheme" IN ('VIOLET', 'BLUE');

ALTER TABLE "BookingSettings" ALTER COLUMN "bookingTheme" SET DEFAULT 'CLASSIC';
