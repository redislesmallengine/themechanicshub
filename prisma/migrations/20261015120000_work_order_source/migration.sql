-- Which screen created a work order ("quick" = Quick Job, "standard" = New Work Order), so reports can filter by job type.
ALTER TABLE "WorkOrder" ADD COLUMN "source" TEXT;
