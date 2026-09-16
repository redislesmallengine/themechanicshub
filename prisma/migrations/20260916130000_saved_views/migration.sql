-- Staff-created, shop-wide filter shortcuts. "resource" scopes rows to
-- whichever list page saved them (starting with "inventory") so other list
-- pages can reuse this same table later instead of getting their own.
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_organizationId_resource_name_key" ON "SavedView"("organizationId", "resource", "name");
CREATE INDEX "SavedView_organizationId_resource_idx" ON "SavedView"("organizationId", "resource");

ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
