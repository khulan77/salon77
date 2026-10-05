-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('DRAFT', 'PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING';


-- Existing phase-1 links were never delivered and cannot be accepted.
UPDATE "Invitation" SET status = CASE WHEN "acceptedAt" IS NOT NULL THEN 'ACCEPTED'::"InvitationStatus" WHEN "revokedAt" IS NOT NULL THEN 'CANCELLED'::"InvitationStatus" ELSE 'DRAFT'::"InvitationStatus" END;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_lifecycle" CHECK (
  (status = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "revokedAt" IS NULL)
  OR (status = 'CANCELLED' AND "revokedAt" IS NOT NULL AND "acceptedAt" IS NULL)
  OR (status IN ('DRAFT', 'PENDING', 'EXPIRED') AND "acceptedAt" IS NULL AND "revokedAt" IS NULL)
);
