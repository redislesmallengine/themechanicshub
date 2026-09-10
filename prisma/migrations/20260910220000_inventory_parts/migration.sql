-- Phase 5 — Inventory & Parts Management

-- CreateTable
CREATE TABLE "PartCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "binLocation" TEXT,
    "costPrice" DECIMAL(10,2),
    "sellPrice" DECIMAL(10,2),
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartStockAdjustment" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartStockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartCategory_organizationId_name_key" ON "PartCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PartCategory_organizationId_idx" ON "PartCategory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_organizationId_sku_key" ON "Part"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "Part_organizationId_idx" ON "Part"("organizationId");

-- CreateIndex
CREATE INDEX "Part_organizationId_barcode_idx" ON "Part"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "PartStockAdjustment_partId_idx" ON "PartStockAdjustment"("partId");

-- AddForeignKey
ALTER TABLE "PartCategory" ADD CONSTRAINT "PartCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartStockAdjustment" ADD CONSTRAINT "PartStockAdjustment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartStockAdjustment" ADD CONSTRAINT "PartStockAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: default part categories for every organization that already
-- exists (today: just Mark's Shop). New organizations get the same set
-- via organizationHooks.afterCreateOrganization (src/lib/auth.ts).
INSERT INTO "PartCategory" (id, "organizationId", name, "createdAt")
SELECT 'ptcat_' || substr(md5(o.id || t.name), 1, 20), o.id, t.name, now()
FROM "Organization" o
CROSS JOIN (VALUES
  ('Spark Plugs'),
  ('Carb Kits'),
  ('Belts'),
  ('Blades'),
  ('2-Stroke Oil'),
  ('Air Filters'),
  ('Fuel Lines'),
  ('Bar & Chain'),
  ('Batteries'),
  ('Other')
) AS t(name);
