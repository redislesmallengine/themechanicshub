-- Which button leads on the Work Orders page: Quick Job or New Work Order (step by step).
ALTER TABLE "ShopProfile" ADD COLUMN "newJobMode" TEXT NOT NULL DEFAULT 'steps';
