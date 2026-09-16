-- Optional Reply-To address for invoice emails, set from Shop Profile.
ALTER TABLE "ShopProfile" ADD COLUMN "invoiceReplyToEmail" TEXT;
