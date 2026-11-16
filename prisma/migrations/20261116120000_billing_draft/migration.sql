-- What was typed on a job's Billing screen, saved as it is typed, so it is not lost and a merged invoice can use it.
ALTER TABLE "WorkOrder" ADD COLUMN "billingDraft" JSONB;
