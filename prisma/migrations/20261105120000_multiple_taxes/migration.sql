-- A shop can have several taxes (each applies to every taxable line), a country (CA/US), and each invoice keeps what its tax was made of.
ALTER TABLE "ShopProfile" ADD COLUMN "taxes" JSONB;
ALTER TABLE "ShopProfile" ADD COLUMN "country" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "taxBreakdown" JSONB;
