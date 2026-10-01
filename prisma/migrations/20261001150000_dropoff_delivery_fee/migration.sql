-- Intake drop-off/pickup method + the shop's own delivery fee default.
ALTER TABLE "WorkOrder" ADD COLUMN "dropOffMethod" TEXT;
ALTER TABLE "ShopProfile" ADD COLUMN "deliveryFee" DECIMAL(10,2);
