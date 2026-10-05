-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phone" TEXT,
    "bio" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBranch" (
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,

    CONSTRAINT "StaffBranch_pkey" PRIMARY KEY ("staffId","branchId")
);

-- CreateTable
CREATE TABLE "StaffService" (
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,

    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("staffId","serviceId")
);

-- CreateTable
CREATE TABLE "WorkingHours" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingBreak" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "workingHoursId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "WorkingBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "fullDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_salonId_active_idx" ON "Staff"("salonId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_id_salonId_key" ON "Staff"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_memberId_salonId_key" ON "Staff"("memberId", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffBranch_staffId_branchId_salonId_key" ON "StaffBranch"("staffId", "branchId", "salonId");

-- CreateIndex
CREATE INDEX "WorkingHours_salonId_branchId_staffId_idx" ON "WorkingHours"("salonId", "branchId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHours_id_salonId_key" ON "WorkingHours"("id", "salonId");

-- CreateIndex
CREATE INDEX "WorkingBreak_salonId_idx" ON "WorkingBreak"("salonId");

-- CreateIndex
CREATE INDEX "TimeOff_salonId_branchId_staffId_startsAt_idx" ON "TimeOff"("salonId", "branchId", "staffId", "startsAt");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_memberId_salonId_fkey" FOREIGN KEY ("memberId", "salonId") REFERENCES "SalonMember"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBranch" ADD CONSTRAINT "StaffBranch_staffId_salonId_fkey" FOREIGN KEY ("staffId", "salonId") REFERENCES "Staff"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBranch" ADD CONSTRAINT "StaffBranch_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_salonId_fkey" FOREIGN KEY ("staffId", "salonId") REFERENCES "Staff"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_salonId_fkey" FOREIGN KEY ("serviceId", "salonId") REFERENCES "Service"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_staffId_branchId_salonId_fkey" FOREIGN KEY ("staffId", "branchId", "salonId") REFERENCES "StaffBranch"("staffId", "branchId", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingBreak" ADD CONSTRAINT "WorkingBreak_workingHoursId_salonId_fkey" FOREIGN KEY ("workingHoursId", "salonId") REFERENCES "WorkingHours"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_staffId_branchId_salonId_fkey" FOREIGN KEY ("staffId", "branchId", "salonId") REFERENCES "StaffBranch"("staffId", "branchId", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_range_check" CHECK ("dayOfWeek" BETWEEN 1 AND 7 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_no_overlap" EXCLUDE USING gist ("staffId" WITH =, "dayOfWeek" WITH =, int4range("startMinute", "endMinute", '[)') WITH &&) WHERE (active);
ALTER TABLE "WorkingBreak" ADD CONSTRAINT "WorkingBreak_range_check" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");
ALTER TABLE "WorkingBreak" ADD CONSTRAINT "WorkingBreak_no_overlap" EXCLUDE USING gist ("workingHoursId" WITH =, int4range("startMinute", "endMinute", '[)') WITH &&);
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_range_check" CHECK ("endsAt" > "startsAt" AND (NOT "fullDay" OR ("startsAt"::time = TIME '16:00' AND "endsAt"::time = TIME '16:00')));
-- DateTime values are UTC; 16:00 UTC is midnight in Asia/Ulaanbaatar.
CREATE FUNCTION check_working_break() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE shift "WorkingHours";
BEGIN
  SELECT * INTO shift FROM "WorkingHours" WHERE id = NEW."workingHoursId" AND "salonId" = NEW."salonId" FOR UPDATE;
  IF NOT FOUND OR NOT shift.active OR NEW."startMinute" < shift."startMinute" OR NEW."endMinute" > shift."endMinute" THEN
    RAISE EXCEPTION 'Break must be inside an active shift' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "WorkingBreak_inside_shift" BEFORE INSERT OR UPDATE ON "WorkingBreak" FOR EACH ROW EXECUTE FUNCTION check_working_break();
CREATE FUNCTION check_shift_breaks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "WorkingBreak" WHERE "workingHoursId" = NEW.id AND (NOT NEW.active OR "startMinute" < NEW."startMinute" OR "endMinute" > NEW."endMinute")) THEN
    RAISE EXCEPTION 'Shift must contain its breaks' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "WorkingHours_contain_breaks" BEFORE UPDATE ON "WorkingHours" FOR EACH ROW EXECUTE FUNCTION check_shift_breaks();
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffBranch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkingHours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkingBreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeOff" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Staff", "StaffBranch", "StaffService", "WorkingHours", "WorkingBreak", "TimeOff" FROM anon, authenticated;
