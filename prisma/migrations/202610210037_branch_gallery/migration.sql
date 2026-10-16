-- Additive: a photo gallery per branch. The first photo is the branch's main
-- photo; "Branch"."imageUrl" keeps mirroring it.
CREATE TABLE "BranchImage" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BranchImage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BranchImage_id_salonId_key" ON "BranchImage"("id", "salonId");
CREATE INDEX "BranchImage_branchId_sortOrder_idx" ON "BranchImage"("branchId", "sortOrder");
CREATE INDEX "BranchImage_salonId_idx" ON "BranchImage"("salonId");
ALTER TABLE "BranchImage" ADD CONSTRAINT "BranchImage_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchImage" ADD CONSTRAINT "BranchImage_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchImage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BranchImage" FROM anon, authenticated;

-- An existing branch photo becomes the first photo of its gallery.
INSERT INTO "BranchImage" ("id", "salonId", "branchId", "url", "sortOrder")
SELECT 'bi_' || md5("id" || "imageUrl"), "salonId", "id", "imageUrl", 0
FROM "Branch"
WHERE "imageUrl" IS NOT NULL;
