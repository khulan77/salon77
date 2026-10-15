-- Guest ratings after a finished visit; one per visit.
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "customerName" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "Review_comment_check" CHECK ("comment" IS NULL OR char_length("comment") <= 1000),
    CONSTRAINT "Review_customerName_check" CHECK (char_length("customerName") BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE UNIQUE INDEX "Review_id_salonId_key" ON "Review"("id", "salonId");
CREATE UNIQUE INDEX "Review_bookingId_salonId_key" ON "Review"("bookingId", "salonId");
CREATE INDEX "Review_salonId_createdAt_idx" ON "Review"("salonId", "createdAt");
ALTER TABLE "Review" ADD CONSTRAINT "Review_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_salonId_fkey" FOREIGN KEY ("bookingId", "salonId") REFERENCES "Booking"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Review" FROM anon, authenticated;
