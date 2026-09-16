-- Fast partial-match search for Inventory at real scale (thousands of
-- parts). A plain ILIKE '%term%' can't use a normal btree index because of
-- the leading wildcard -- pg_trgm's GIN indexes are built exactly for that
-- case (also tolerates typos/partial words). Postgres's planner picks these
-- up automatically for existing ILIKE queries -- no application code change
-- needed, just faster search once the index exists.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Part_name_trgm_idx" ON "Part" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Part_sku_trgm_idx" ON "Part" USING gin ("sku" gin_trgm_ops);
CREATE INDEX "Part_barcode_trgm_idx" ON "Part" USING gin ("barcode" gin_trgm_ops);
