-- Indexes for the real (non-mockup) Dashboard's aggregate queries --
-- technician workload, opened/closed trend, revenue trend, new customers,
-- top-selling parts. None of these access patterns existed before.
CREATE INDEX "WorkOrder_organizationId_assignedToUserId_idx" ON "WorkOrder"("organizationId", "assignedToUserId");
CREATE INDEX "WorkOrder_organizationId_createdAt_idx" ON "WorkOrder"("organizationId", "createdAt");
CREATE INDEX "WorkOrder_organizationId_closedAt_idx" ON "WorkOrder"("organizationId", "closedAt");

CREATE INDEX "WorkOrderPart_partId_idx" ON "WorkOrderPart"("partId");

CREATE INDEX "Customer_organizationId_createdAt_idx" ON "Customer"("organizationId", "createdAt");

CREATE INDEX "Invoice_organizationId_paidAt_idx" ON "Invoice"("organizationId", "paidAt");
