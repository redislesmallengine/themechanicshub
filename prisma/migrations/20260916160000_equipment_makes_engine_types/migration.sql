-- Configurable Make / Engine Type dropdowns for the Equipment form
-- (Settings -> Equipment Makes / Engine Types). Equipment.make and
-- Equipment.engineType stay the free-text columns they already are --
-- these two tables just constrain what the form's dropdowns offer.
CREATE TABLE "EquipmentMake" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentMake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EquipmentMake_organizationId_name_key" ON "EquipmentMake"("organizationId", "name");
CREATE INDEX "EquipmentMake_organizationId_idx" ON "EquipmentMake"("organizationId");
ALTER TABLE "EquipmentMake" ADD CONSTRAINT "EquipmentMake_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EngineType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EngineType_organizationId_name_key" ON "EngineType"("organizationId", "name");
CREATE INDEX "EngineType_organizationId_idx" ON "EngineType"("organizationId");
ALTER TABLE "EngineType" ADD CONSTRAINT "EngineType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed every existing shop with the same values the app used to hardcode
-- (the Make datalist suggestions and the fixed Engine Type list), so no
-- shop's dropdown starts out empty after this deploy.
INSERT INTO "EquipmentMake" ("id", "organizationId", "name")
SELECT md5(random()::text || clock_timestamp()::text || o.id || v.name), o.id, v.name
FROM "Organization" o
CROSS JOIN (VALUES ('Honda'), ('Briggs & Stratton'), ('Toro'), ('Husqvarna'), ('Stihl'), ('MTD'), ('Craftsman'), ('Kohler'), ('Yamaha'), ('Mercury')) AS v(name)
ON CONFLICT DO NOTHING;

INSERT INTO "EngineType" ("id", "organizationId", "name")
SELECT md5(random()::text || clock_timestamp()::text || o.id || v.name), o.id, v.name
FROM "Organization" o
CROSS JOIN (VALUES ('2-stroke'), ('4-stroke'), ('Electric'), ('Battery')) AS v(name)
ON CONFLICT DO NOTHING;

-- Also cover any make/engineType value already saved on existing Equipment
-- but not one of the defaults above, so no existing record's value is
-- suddenly missing from its own dropdown.
INSERT INTO "EquipmentMake" ("id", "organizationId", "name")
SELECT md5(random()::text || clock_timestamp()::text || e."organizationId" || e."make"), e."organizationId", e."make"
FROM "Equipment" e
WHERE e."make" IS NOT NULL AND e."make" != ''
ON CONFLICT DO NOTHING;

INSERT INTO "EngineType" ("id", "organizationId", "name")
SELECT md5(random()::text || clock_timestamp()::text || e."organizationId" || e."engineType"), e."organizationId", e."engineType"
FROM "Equipment" e
WHERE e."engineType" IS NOT NULL AND e."engineType" != ''
ON CONFLICT DO NOTHING;
