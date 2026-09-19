-- Folds 2+ work orders (same customer) into ONE combined invoice.
-- Invoice.workOrderId stays a 1:1 link for the existing single-work-order
-- flow -- this table only ever has rows for combined invoices.
CREATE TABLE "InvoiceWorkOrder" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceWorkOrder_workOrderId_key" ON "InvoiceWorkOrder"("workOrderId");
CREATE INDEX "InvoiceWorkOrder_invoiceId_idx" ON "InvoiceWorkOrder"("invoiceId");

ALTER TABLE "InvoiceWorkOrder" ADD CONSTRAINT "InvoiceWorkOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceWorkOrder" ADD CONSTRAINT "InvoiceWorkOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
