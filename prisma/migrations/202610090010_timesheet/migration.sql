-- Additive. Existing salons keep per-staff weekly schedules (CUSTOM).
CREATE TYPE "StaffHoursMode" AS ENUM ('CUSTOM', 'SALON_HOURS');
ALTER TABLE "BookingSettings" ADD COLUMN "staffHoursMode" "StaffHoursMode" NOT NULL DEFAULT 'CUSTOM';
-- Daily attendance marked by owners, managers or reception.
CREATE TYPE "AttendanceStatus" AS ENUM ('WORKED', 'OFF');
CREATE TABLE "StaffAttendance" (
    "salonId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "updatedByMemberId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("staffId", "date")
);
CREATE INDEX "StaffAttendance_salonId_date_idx" ON "StaffAttendance"("salonId", "date");
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_salonId_fkey" FOREIGN KEY ("staffId", "salonId") REFERENCES "Staff"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_updatedByMemberId_salonId_fkey" FOREIGN KEY ("updatedByMemberId", "salonId") REFERENCES "SalonMember"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StaffAttendance" FROM anon, authenticated;
