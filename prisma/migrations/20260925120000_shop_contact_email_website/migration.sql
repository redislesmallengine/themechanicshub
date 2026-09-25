-- Public contact email + website for the shop, shown on invoices/receipts.
ALTER TABLE "ShopProfile" ADD COLUMN "email" TEXT;
ALTER TABLE "ShopProfile" ADD COLUMN "website" TEXT;
