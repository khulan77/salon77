-- Product catalogue for retail and supplies, with stock kept per branch.
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'ш',
    "costMnt" INTEGER NOT NULL DEFAULT 0,
    "priceMnt" INTEGER NOT NULL DEFAULT 0,
    "lowStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProductStock" (
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("productId", "branchId")
);
CREATE UNIQUE INDEX "Product_id_salonId_key" ON "Product"("id", "salonId");
CREATE UNIQUE INDEX "Product_salonId_sku_key" ON "Product"("salonId", "sku");
CREATE INDEX "Product_salonId_active_idx" ON "Product"("salonId", "active");
CREATE INDEX "ProductStock_salonId_branchId_idx" ON "ProductStock"("salonId", "branchId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_salonId_fkey" FOREIGN KEY ("productId", "salonId") REFERENCES "Product"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_values_check" CHECK (
  "costMnt" BETWEEN 0 AND 1000000000 AND "priceMnt" BETWEEN 0 AND 1000000000
  AND "lowStock" BETWEEN 0 AND 1000000);
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_quantity_check" CHECK ("quantity" BETWEEN 0 AND 1000000);
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductStock" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Product", "ProductStock" FROM anon, authenticated;
