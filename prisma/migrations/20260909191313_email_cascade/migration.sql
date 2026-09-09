-- AlterTable: EmailSettings moves from a single "provider" + "credentials"
-- to three independent, optional per-provider credential columns, so a
-- shop can configure any/all of Resend, SendGrid, and SMTP at once.
-- Safe to drop rather than migrate: no shop has saved settings yet.
ALTER TABLE "EmailSettings" DROP COLUMN "provider";
ALTER TABLE "EmailSettings" DROP COLUMN "credentials";
ALTER TABLE "EmailSettings" ADD COLUMN "resendCredentials" TEXT;
ALTER TABLE "EmailSettings" ADD COLUMN "sendgridCredentials" TEXT;
ALTER TABLE "EmailSettings" ADD COLUMN "smtpCredentials" TEXT;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_provider_createdAt_idx" ON "EmailLog"("organizationId", "provider", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
