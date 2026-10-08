-- Branch opening hours: the default shift for staff assigned to the branch.
ALTER TABLE "Branch" ADD COLUMN "openMinute" INTEGER NOT NULL DEFAULT 600,
ADD COLUMN "closeMinute" INTEGER NOT NULL DEFAULT 1140;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_hours_check" CHECK (
 "openMinute" >= 0 AND "closeMinute" <= 1440 AND "closeMinute" > "openMinute");
