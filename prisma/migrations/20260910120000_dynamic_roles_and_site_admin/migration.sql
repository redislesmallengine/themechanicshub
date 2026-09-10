-- Platform-level "site administrator" flag — separate from any shop's own
-- Owner. See src/lib/rbac.ts.
ALTER TABLE "User" ADD COLUMN "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Better Auth organization plugin's own Dynamic Access Control
-- table (dynamicAccessControl enabled in src/lib/auth.ts). Field shapes
-- hand-matched against node_modules/better-auth/dist/plugins/organization/
-- organization.mjs's organizationRoleSchema for better-auth 1.7.3, same
-- approach as every other Better Auth table in this schema.
CREATE TABLE "OrganizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable: the site admin's shared role library — see prisma/schema.prisma
-- for why this exists alongside OrganizationRole above.
CREATE TABLE "PlatformRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationRole_organizationId_idx" ON "OrganizationRole"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRole_organizationId_role_key" ON "OrganizationRole"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRole_key_key" ON "PlatformRole"("key");

-- AddForeignKey
ALTER TABLE "OrganizationRole" ADD CONSTRAINT "OrganizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: the four non-owner roles that exist in code today (src/lib/
-- permissions.ts), now as editable PlatformRole rows instead of hardcoded
-- Better Auth roles. "owner" is deliberately NOT a row here — it stays
-- hardcoded (Better Auth's `creatorRole` needs a statically-defined role to
-- exist), and is protected from editing/deletion in the Site Admin UI by
-- code, not by a DB flag.
INSERT INTO "PlatformRole" (id, key, label, description, "isSystem", permissions, "createdAt", "updatedAt")
VALUES
  ('plr_manager', 'manager', 'Shop Manager',
   'Full operational control — invoices, inventory, expenses, work orders. Not billing.',
   false,
   '{"organization":["update"],"member":["create","update","delete"],"invitation":["create","cancel"],"team":["create","update","delete"],"ac":["read"],"workOrder":["create","update","delete"],"invoice":["create","update","void","viewMargins"],"inventory":["create","update"],"expense":["create","update"],"customer":["create","update"],"report":["view"],"shopSettings":["update"],"billing":[]}'::jsonb,
   now(), now()),
  ('plr_technician', 'technician', 'Technician / Mechanic',
   'Create and edit work orders and invoices, look up parts. Can''t void invoices, change settings, or see profit margins.',
   false,
   '{"organization":[],"member":[],"invitation":[],"team":[],"ac":[],"workOrder":["create","update"],"invoice":["create","update"],"inventory":["create","update"],"expense":[],"customer":["create","update"],"report":[],"shopSettings":[],"billing":[]}'::jsonb,
   now(), now()),
  ('plr_bookkeeper', 'bookkeeper', 'Bookkeeper',
   'Invoices, payments, expenses, receipt OCR, tax reports. Not shop-floor workflows.',
   false,
   '{"organization":[],"member":[],"invitation":[],"team":[],"ac":[],"workOrder":[],"invoice":["update","viewMargins"],"inventory":[],"expense":["create","update"],"customer":[],"report":["view"],"shopSettings":[],"billing":[]}'::jsonb,
   now(), now()),
  ('plr_frontdesk', 'frontdesk', 'Read-Only / Front Desk',
   'Customer status and equipment intake lookup only.',
   false,
   '{"organization":[],"member":[],"invitation":[],"team":[],"ac":[],"workOrder":["create"],"invoice":[],"inventory":[],"expense":[],"customer":["create","update"],"report":[],"shopSettings":[],"billing":[]}'::jsonb,
   now(), now());

-- Mirror every seeded PlatformRole into OrganizationRole for every
-- Organization that already exists (today: just Red Isle). Keeps Better
-- Auth's own permission engine (which only ever reads OrganizationRole, not
-- PlatformRole) in sync with the shared library above from the moment this
-- migration runs — nobody's effective permissions change today, since these
-- are exactly the permission sets already hardcoded in src/lib/permissions.ts.
INSERT INTO "OrganizationRole" (id, "organizationId", role, permission, "createdAt")
SELECT 'orgrole_' || substr(md5(o.id || pr.key), 1, 20), o.id, pr.key, pr.permissions::text, now()
FROM "Organization" o
CROSS JOIN "PlatformRole" pr;
