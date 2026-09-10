-- Canadianize "Labor" -> "Labour" everywhere, including the columns
-- themselves — a rename, not a drop/recreate, so existing values survive.
ALTER TABLE "ShopProfile" RENAME COLUMN "laborRate" TO "labourRate";
ALTER TABLE "WorkOrder" RENAME COLUMN "laborHours" TO "labourHours";
