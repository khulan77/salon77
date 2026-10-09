-- Fixed-window counters for public endpoints. Keys hold hashed client
-- fingerprints, never raw IP addresses.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key", "windowStart")
);
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RateLimit" FROM anon, authenticated;
-- 0 keeps unconfirmed online bookings until staff act (the previous behaviour).
ALTER TABLE "BookingSettings" ADD COLUMN "pendingExpiryMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_pending_expiry_check" CHECK ("pendingExpiryMinutes" BETWEEN 0 AND 10080);
