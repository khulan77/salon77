-- Additive: photos of the salon's space and work, shown on public pages.
CREATE TABLE "SalonImage" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalonImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalonImage_salonId_sortOrder_idx" ON "SalonImage"("salonId", "sortOrder");
ALTER TABLE "SalonImage" ADD CONSTRAINT "SalonImage_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalonImage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SalonImage" FROM anon, authenticated;
