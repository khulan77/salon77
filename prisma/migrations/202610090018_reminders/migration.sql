-- Additive. Reminders are outbox rows scheduled ahead via "availableAt".
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'BOOKING_REMINDER';
-- Minutes before the appointment; default one day.
ALTER TABLE "BookingSettings" ADD COLUMN "reminderMinutes" INTEGER[] NOT NULL DEFAULT ARRAY[1440];
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_reminder_check" CHECK (
  "reminderMinutes" <@ ARRAY[60, 120, 180, 1440, 2880]
  AND cardinality("reminderMinutes") <= 5);
