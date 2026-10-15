-- Monthly billing: a 14-day trial from approval, then paid 30-day periods.
ALTER TABLE "Salon"
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "paidUntil" TIMESTAMP(3);
-- Salons approved before billing existed start a full trial today.
UPDATE "Salon"
SET "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '14 days'
WHERE "reviewStatus" = 'APPROVED';

CREATE TABLE "SalonPayment" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "amountMnt" INTEGER NOT NULL,
    "branches" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalonPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalonPayment_amount_check" CHECK ("amountMnt" >= 0),
    CONSTRAINT "SalonPayment_branches_check" CHECK ("branches" >= 1),
    CONSTRAINT "SalonPayment_period_check" CHECK ("periodEnd" > "periodStart"),
    CONSTRAINT "SalonPayment_note_check" CHECK ("note" IS NULL OR char_length("note") <= 200)
);
CREATE INDEX "SalonPayment_salonId_createdAt_idx" ON "SalonPayment"("salonId", "createdAt");
CREATE INDEX "SalonPayment_createdAt_idx" ON "SalonPayment"("createdAt");
ALTER TABLE "SalonPayment" ADD CONSTRAINT "SalonPayment_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalonPayment" ADD CONSTRAINT "SalonPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalonPayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SalonPayment" FROM anon, authenticated;

-- Single settings row; the price stays empty until the operator sets it.
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pricePerBranchMnt" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlatformSetting_single_check" CHECK ("id" = 'default'),
    CONSTRAINT "PlatformSetting_price_check" CHECK ("pricePerBranchMnt" IS NULL OR "pricePerBranchMnt" BETWEEN 0 AND 10000000)
);
ALTER TABLE "PlatformSetting" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PlatformSetting" FROM anon, authenticated;
