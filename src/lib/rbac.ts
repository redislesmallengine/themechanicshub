/**
 * Site administration: the platform-level "super duper admin" role, and the
 * shared, editable Role library it manages.
 *
 * Two different "role" concepts live side by side in this app:
 *  - `User.isSiteAdmin` — a platform flag, unrelated to any shop. Someone
 *    with this flag manages the Role library below. Not a shop Member.
 *  - `Member.role` — which role (within a shop) a staff account has:
 *    either the hardcoded "owner" (src/lib/permissions.ts) or the `key` of
 *    a PlatformRole row here.
 *
 * Why two tables (PlatformRole + OrganizationRole) for one role library:
 * Better Auth's organization plugin ships a "Dynamic Access Control"
 * feature (dynamicAccessControl in src/lib/auth.ts) that reads a table
 * called OrganizationRole at request time to resolve auth.api.hasPermission
 * — every existing call site keeps working unmodified. But that table is
 * scoped per-organization, and Better Auth's own endpoints for writing to
 * it require the caller to already be a member of the target org — which a
 * platform site admin isn't, by design. So PlatformRole is the actual
 * source of truth site admins edit (one shared library, per the pilot
 * decision to not do per-shop custom roles yet), and every write here
 * mirrors into OrganizationRole for every existing Organization so Better
 * Auth's runtime engine sees it immediately.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statement, HIDDEN_RESOURCES } from "@/lib/permissions";

export interface RoleOption {
  key: string;
  label: string;
  description: string | null;
  isSystem: boolean;
}

/** Not a PlatformRole row — see file header for why "owner" stays hardcoded. */
export const OWNER_ROLE: RoleOption = {
  key: "owner",
  label: "Owner / Super-Admin",
  description: "Full control: billing, staff, settings, and financial reports.",
  isSystem: true,
};

/** Every role a shop Member can be assigned: the hardcoded Owner, plus the shared PlatformRole library, in that order. */
export async function listRoles(): Promise<RoleOption[]> {
  const rows = await prisma.platformRole.findMany({ orderBy: { createdAt: "asc" } });
  return [
    OWNER_ROLE,
    ...rows.map((r) => ({ key: r.key, label: r.label, description: r.description, isSystem: r.isSystem })),
  ];
}

/** O(1) lookup map built from listRoles() — pass around instead of re-querying per row on a staff list. */
export function roleMapFrom(roles: RoleOption[]): Record<string, RoleOption> {
  return Object.fromEntries(roles.map((r) => [r.key, r]));
}

export async function requireSiteAdmin() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user.isSiteAdmin) redirect("/dashboard");
  return session;
}

/** Slug a role's display name into a Member.role-safe key: lowercase, hyphenated, never "owner". */
export function slugifyRoleKey(label: string): string {
  const key = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key === "owner" ? `${key}-role` : key;
}

/**
 * Keeps a role's PlatformRole.permissions submission honest: only resources
 * that exist in the app's `statement` (src/lib/permissions.ts) are kept,
 * each pruned to only its declared actions. Resources the rights-editor UI
 * doesn't expose (HIDDEN_RESOURCES) are carried forward from `existing`
 * unchanged (or default to [] for a brand-new role) rather than dropped,
 * since Better Auth's own org-plugin endpoints (invite/remove/etc.) still
 * check them.
 */
export function sanitizePermissions(
  input: Record<string, string[]>,
  existing?: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const resource of Object.keys(statement) as (keyof typeof statement)[]) {
    if ((HIDDEN_RESOURCES as readonly string[]).includes(resource)) {
      out[resource] = existing?.[resource] ?? [];
      continue;
    }
    const validActions = statement[resource] as readonly string[];
    const requested = input[resource] ?? [];
    out[resource] = validActions.filter((a) => requested.includes(a));
  }
  return out;
}

/** Writes one PlatformRole's permissions into OrganizationRole for every existing Organization — see file header. */
export async function syncRoleToAllOrgs(key: string, permissions: Record<string, string[]>) {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const permissionJson = JSON.stringify(permissions);
  await prisma.$transaction(
    orgs.map((o) =>
      prisma.organizationRole.upsert({
        where: { organizationId_role: { organizationId: o.id, role: key } },
        create: { organizationId: o.id, role: key, permission: permissionJson },
        update: { permission: permissionJson, updatedAt: new Date() },
      })
    )
  );
}

/** Removes a deleted role's mirrored rows from every org's OrganizationRole table. */
export async function removeRoleFromAllOrgs(key: string) {
  await prisma.organizationRole.deleteMany({ where: { role: key } });
}

/** Copies the current shared library into a brand-new Organization's OrganizationRole rows — call right after creating a shop. */
export async function seedDefaultRolesForOrg(organizationId: string) {
  const roles = await prisma.platformRole.findMany();
  if (roles.length === 0) return;
  await prisma.organizationRole.createMany({
    data: roles.map((r) => ({
      organizationId,
      role: r.key,
      permission: JSON.stringify(r.permissions as Record<string, string[]>),
    })),
    skipDuplicates: true,
  });
}

/** How many shop staff accounts currently hold this role, across every org — a role in use can't be deleted. */
export async function countMembersWithRole(key: string): Promise<number> {
  return prisma.member.count({ where: { role: key } });
}
