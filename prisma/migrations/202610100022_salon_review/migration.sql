-- Salon applications: a new salon is reviewed by the platform before it is
-- shown to the public. Existing salons stay approved.
CREATE TYPE "SalonReview" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "Salon"
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "serviceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "staffCount" INTEGER,
  ADD COLUMN "reviewStatus" "SalonReview" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Salon_staffCount_check" CHECK ("staffCount" IS NULL OR "staffCount" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "Salon_reviewNote_check" CHECK ("reviewNote" IS NULL OR char_length("reviewNote") <= 500);
-- The review queue reads pending salons oldest first.
CREATE INDEX "Salon_reviewStatus_submittedAt_idx" ON "Salon"("reviewStatus", "submittedAt");
ALTER TABLE "PlatformAuditLog" DROP CONSTRAINT "PlatformAuditLog_action_check";
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_action_check"
  CHECK ("action" IN ('SUSPEND_SALON', 'ACTIVATE_SALON', 'APPROVE_SALON', 'REJECT_SALON'));
