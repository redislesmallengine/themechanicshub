-- A permanent copy of every email the app sends -- exact subject/HTML,
-- written centrally from sendMail() (src/lib/email.ts).
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "provider" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SentEmail_organizationId_createdAt_idx" ON "SentEmail"("organizationId", "createdAt");
CREATE INDEX "SentEmail_relatedType_relatedId_idx" ON "SentEmail"("relatedType", "relatedId");
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
