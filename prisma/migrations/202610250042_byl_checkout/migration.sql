-- Monthly fees can be paid online through Byl (QPay, SocialPay, bank apps);
-- those payments have no operator who recorded them.
ALTER TABLE "SalonPayment" ALTER COLUMN "recordedById" DROP NOT NULL;

CREATE TYPE "CheckoutStatus" AS ENUM ('OPEN', 'PAID', 'EXPIRED');

CREATE TABLE "BillingCheckout" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "bylId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "amountMnt" INTEGER NOT NULL,
    "branches" INTEGER NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'OPEN',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "BillingCheckout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCheckout_bylId_key" ON "BillingCheckout"("bylId");
CREATE UNIQUE INDEX "BillingCheckout_paymentId_key" ON "BillingCheckout"("paymentId");
CREATE INDEX "BillingCheckout_salonId_status_createdAt_idx" ON "BillingCheckout"("salonId", "status", "createdAt");

ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SalonPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingCheckout" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BillingCheckout" FROM anon, authenticated;
