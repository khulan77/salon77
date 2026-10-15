-- A public introduction for each master; the existing bio stays internal.
ALTER TABLE "Staff"
  ADD COLUMN "about" TEXT,
  ADD CONSTRAINT "Staff_about_check" CHECK ("about" IS NULL OR char_length("about") <= 500);
