-- The operator may set one salon's monthly fee by hand; empty keeps the
-- per-branch price from PlatformSetting.
ALTER TABLE "Salon"
  ADD COLUMN "monthlyPriceMnt" INTEGER,
  ADD CONSTRAINT "Salon_monthlyPriceMnt_check" CHECK ("monthlyPriceMnt" IS NULL OR "monthlyPriceMnt" BETWEEN 0 AND 100000000);
