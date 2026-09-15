-- Invoice line items can now be rung up directly from real Inventory
-- (see addInventoryLineItem), decrementing actual stock through the same
-- applyStockAdjustment() Work Orders already use, instead of only ever
-- being typed in free-text.
ALTER TABLE "InvoiceLineItem" ADD COLUMN "partId" TEXT;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InvoiceLineItem_partId_idx" ON "InvoiceLineItem"("partId");
