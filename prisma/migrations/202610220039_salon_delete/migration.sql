-- A deleted salon's audit trail stays: the log keeps the salon's name, and
-- its link to the salon becomes NULL instead of disappearing with it.
ALTER TABLE "PlatformAuditLog" ALTER COLUMN "salonId" DROP NOT NULL;
ALTER TABLE "PlatformAuditLog" ADD COLUMN "salonName" TEXT;
ALTER TABLE "PlatformAuditLog" DROP CONSTRAINT "PlatformAuditLog_salonId_fkey";
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" DROP CONSTRAINT "PlatformAuditLog_action_check";
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_action_check"
  CHECK ("action" IN ('SUSPEND_SALON', 'ACTIVATE_SALON', 'APPROVE_SALON', 'REJECT_SALON', 'DELETE_SALON'));
