-- Work order numbers (WO-1001, WO-1002, ...): counted per shop, in the order the jobs were created.

ALTER TABLE "ShopProfile" ADD COLUMN "nextWorkOrderNumber" INTEGER NOT NULL DEFAULT 1001;
ALTER TABLE "WorkOrder" ADD COLUMN "number" INTEGER;

-- Number the jobs that already exist: oldest first within each shop, starting at 1001.
UPDATE "WorkOrder" w
SET "number" = n.rn + 1000
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt", id) AS rn FROM "WorkOrder") n
WHERE w.id = n.id;

-- Each shop's counter continues after its highest number.
UPDATE "ShopProfile" sp
SET "nextWorkOrderNumber" = COALESCE((SELECT MAX(w."number") FROM "WorkOrder" w WHERE w."organizationId" = sp."organizationId"), 1000) + 1;

ALTER TABLE "WorkOrder" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "WorkOrder_organizationId_number_key" ON "WorkOrder"("organizationId", "number");
