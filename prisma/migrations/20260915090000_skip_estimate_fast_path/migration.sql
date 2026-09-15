-- Optional verbal price ceiling captured on the "customer said just fix it"
-- fast path, which skips the formal estimate/approval flow entirely.
ALTER TABLE "WorkOrder" ADD COLUMN "notToExceedAmount" DECIMAL(10,2);
