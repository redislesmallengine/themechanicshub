-- New shops wait for site-administrator approval before anyone can sign in.
-- Every shop that exists today is already trusted, so they are approved here;
-- only rows created after this migration start as 'pending'.
ALTER TABLE "Organization" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Organization" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "approvalNote" TEXT;

UPDATE "Organization" SET "approvalStatus" = 'approved', "approvedAt" = CURRENT_TIMESTAMP;

CREATE INDEX "Organization_approvalStatus_idx" ON "Organization"("approvalStatus");
