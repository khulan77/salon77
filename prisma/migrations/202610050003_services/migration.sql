-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMnt" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "onlineBookable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBranch" (
    "serviceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,

    CONSTRAINT "ServiceBranch_pkey" PRIMARY KEY ("serviceId","branchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_id_salonId_key" ON "ServiceCategory"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_salonId_name_key" ON "ServiceCategory"("salonId", "name");

-- CreateIndex
CREATE INDEX "Service_salonId_active_idx" ON "Service"("salonId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Service_id_salonId_key" ON "Service"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBranch_serviceId_branchId_salonId_key" ON "ServiceBranch"("serviceId", "branchId", "salonId");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_salonId_fkey" FOREIGN KEY ("categoryId", "salonId") REFERENCES "ServiceCategory"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBranch" ADD CONSTRAINT "ServiceBranch_serviceId_salonId_fkey" FOREIGN KEY ("serviceId", "salonId") REFERENCES "Service"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBranch" ADD CONSTRAINT "ServiceBranch_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "Branch"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Service" ADD CONSTRAINT "Service_price_range" CHECK ("priceMnt" >= 0 AND "priceMnt" <= 1000000000);
ALTER TABLE "Service" ADD CONSTRAINT "Service_duration_range" CHECK ("durationMinutes" > 0 AND "durationMinutes" <= 1440);
ALTER TABLE "ServiceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceBranch" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE role_name text; BEGIN
FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
EXECUTE format('REVOKE ALL ON TABLE "ServiceCategory", "Service", "ServiceBranch" FROM %I', role_name);
END IF; END LOOP; END $$;
