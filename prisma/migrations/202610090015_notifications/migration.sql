-- Outbox of customer notifications, written in the same transaction as the
-- booking change and delivered afterwards. Additive; off by default per salon.
CREATE TYPE "NotificationEvent" AS ENUM ('BOOKING_RECEIVED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED');
CREATE TYPE "NotificationChannel" AS ENUM ('SMS');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "bookingId" TEXT,
    "event" "NotificationEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_salonId_dedupeKey_key" ON "Notification"("salonId", "dedupeKey");
CREATE INDEX "Notification_status_availableAt_idx" ON "Notification"("status", "availableAt");
CREATE INDEX "Notification_salonId_createdAt_idx" ON "Notification"("salonId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_salonId_fkey" FOREIGN KEY ("bookingId", "salonId") REFERENCES "Booking"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts_check" CHECK ("attempts" BETWEEN 0 AND 20);
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Notification" FROM anon, authenticated;
ALTER TABLE "BookingSettings" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
