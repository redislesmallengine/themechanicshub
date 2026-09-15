-- Invoices no longer require a Work Order or a Customer behind them (a
-- counter/parts-only sale needs neither), and can optionally carry a
-- machine (Equipment) directly, independent of any Work Order.

-- workOrderId / customerId: required -> optional. Existing FK/unique
-- constraints are untouched -- nullability is orthogonal to them, and a
-- unique index already tolerates multiple NULLs in Postgres.
ALTER TABLE "Invoice" ALTER COLUMN "workOrderId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "customerId" DROP NOT NULL;

-- New: which machine this invoice is for, independent of any Work Order.
ALTER TABLE "Invoice" ADD COLUMN "equipmentId" TEXT;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_equipmentId_idx" ON "Invoice"("equipmentId");

-- New: stored classification -- "partsOnly" | "repairService" | "combined".
-- Every existing invoice came from the old work-order-only flow, so
-- backfill them as repairService before the default takes over for new rows.
ALTER TABLE "Invoice" ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'partsOnly';
UPDATE "Invoice" SET "invoiceType" = 'repairService' WHERE "workOrderId" IS NOT NULL;
