-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'RECEPTION', 'OWNER');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "BookingSource" NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerPhoneSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdByMemberId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_salonId_name_idx" ON "Customer"("salonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_salonId_key" ON "Customer"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_salonId_phone_key" ON "Customer"("salonId", "phone");

-- CreateIndex
CREATE INDEX "Booking_salonId_branchId_startAt_idx" ON "Booking"("salonId", "branchId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_salonId_staffId_startAt_idx" ON "Booking"("salonId", "staffId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_salonId_customerId_startAt_idx" ON "Booking"("salonId", "customerId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_salonId_status_startAt_idx" ON "Booking"("salonId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_id_salonId_key" ON "Booking"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_salonId_idempotencyKey_key" ON "Booking"("salonId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_salonId_fkey" FOREIGN KEY ("customerId", "salonId") REFERENCES "Customer"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_salonId_fkey" FOREIGN KEY ("serviceId", "salonId") REFERENCES "Service"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_salonId_fkey" FOREIGN KEY ("staffId", "salonId") REFERENCES "Staff"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByMemberId_salonId_fkey" FOREIGN KEY ("createdByMemberId", "salonId") REFERENCES "SalonMember"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The same staff cannot occupy overlapping appointments, including across branches.
-- Historical completed/no-show appointments remain occupied; only cancellation releases a slot.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap" EXCLUDE USING gist
 ("staffId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
 WHERE (status <> 'CANCELLED');
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_values_check" CHECK (
 "endAt" > "startAt" AND "durationMinutesSnapshot" BETWEEN 1 AND 1440
 AND "endAt" = "startAt" + "durationMinutesSnapshot" * interval '1 minute'
 AND "priceSnapshot" BETWEEN 0 AND 1000000000 AND version > 0);
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Customer", "Booking" FROM anon, authenticated;
