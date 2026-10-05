-- Short random alias for an invoice's view link, used to keep WhatsApp messages short (/i/[code]).
ALTER TABLE "Invoice" ADD COLUMN "shortCode" TEXT;
CREATE UNIQUE INDEX "Invoice_shortCode_key" ON "Invoice"("shortCode");
