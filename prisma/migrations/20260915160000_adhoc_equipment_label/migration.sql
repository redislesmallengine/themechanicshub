-- Option 2: a standalone invoice can now describe a machine in plain text
-- with no registered Equipment record behind it (and so no Customer
-- either) -- for a walk-in repair with nothing on file at all.
ALTER TABLE "Invoice" ADD COLUMN "adHocEquipmentLabel" TEXT;
