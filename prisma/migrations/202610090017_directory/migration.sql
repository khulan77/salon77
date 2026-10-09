-- Additive: salons appear on the public home page unless they opt out.
ALTER TABLE "BookingSettings" ADD COLUMN "listedInDirectory" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Branch_district_idx" ON "Branch"("district");
