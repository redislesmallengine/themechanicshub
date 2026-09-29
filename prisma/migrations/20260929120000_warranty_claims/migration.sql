-- Warranty claim invoicing: who a shop bills for warranty-covered repairs,
-- separate from the equipment owner (Invoice.customerId/equipmentId).
CREATE TABLE "WarrantyProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarrantyProvider_organizationId_name_key" ON "WarrantyProvider"("organizationId", "name");
CREATE INDEX "WarrantyProvider_organizationId_idx" ON "WarrantyProvider"("organizationId");

ALTER TABLE "WarrantyProvider" ADD CONSTRAINT "WarrantyProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD COLUMN "payerType" TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE "Invoice" ADD COLUMN "warrantyProviderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "claimNumber" TEXT;

CREATE INDEX "Invoice_organizationId_payerType_idx" ON "Invoice"("organizationId", "payerType");
CREATE INDEX "Invoice_warrantyProviderId_idx" ON "Invoice"("warrantyProviderId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_warrantyProviderId_fkey" FOREIGN KEY ("warrantyProviderId") REFERENCES "WarrantyProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
