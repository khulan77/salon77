-- Who changed a salon from the platform console, and when. Append-only.
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlatformAuditLog_action_check" CHECK ("action" IN ('SUSPEND_SALON', 'ACTIVATE_SALON'))
);
CREATE INDEX "PlatformAuditLog_salonId_createdAt_idx" ON "PlatformAuditLog"("salonId", "createdAt");
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Supports "new salons" counts on the platform overview.
CREATE INDEX "Salon_createdAt_idx" ON "Salon"("createdAt");
CREATE INDEX "Booking_source_createdAt_idx" ON "Booking"("source", "createdAt");
ALTER TABLE "PlatformAuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PlatformAuditLog" FROM anon, authenticated;
