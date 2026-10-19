-- When "Repair finished" was pressed. A job that is Repairing with this set is on the Billing step (no separate status needed).
ALTER TABLE "WorkOrder" ADD COLUMN "repairFinishedAt" TIMESTAMP(3);
