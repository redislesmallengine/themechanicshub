-- Work order flow: the intake pre-approval answer, and "work performed" notes.
ALTER TABLE "WorkOrder" ADD COLUMN "preApprovalRequired" BOOLEAN;
ALTER TABLE "WorkOrder" ADD COLUMN "repairNotes" TEXT;
