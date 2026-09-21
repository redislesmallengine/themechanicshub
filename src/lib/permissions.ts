/**
 * Mechanic Shop Hub — permission statement + the one hardcoded role.
 *
 * Historically this file defined all 5 roles (owner/manager/technician/
 * bookkeeper/frontdesk) as static Better Auth roles. Per the "super duper
 * admin" request, roles other than Owner are now editable/addable/
 * deletable at runtime by a site administrator — see src/lib/rbac.ts
 * (PlatformRole = the shared role library, OrganizationRole = Better
 * Auth's own dynamic-access-control table it reads at request time).
 *
 * "owner" stays hardcoded here and only here: Better Auth's organization
 * plugin needs a statically-defined role for `creatorRole` (src/lib/
 * auth.ts) — whoever creates a shop becomes its Owner — and Owner should
 * never be editable/deletable from the UI regardless (every shop needs one
 * un-lockable-out-of role). Site Admin → Roles enforces that in code by
 * simply never showing "owner" as an editable/deletable row.
 *
 * Source of truth for the resource/action list itself: SAAS
 * ARCHITECTURE.docx (original spec) + build plan Phase 1, grown by each
 * later phase as features land.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Every permission this app cares about, grouped by resource.
 * `defaultStatements` (organization/member/invitation/team/ac) come from
 * Better Auth's organization plugin itself — merging them in means every
 * role, static or dynamic, still satisfies the plugin's own internal
 * checks (e.g. "can this role invite a member").
 *
 * IMPORTANT — whenever a new phase ships a new form/module (inventory
 * fields, reports, etc.), add its resource/actions here AND to
 * PERMISSION_GROUPS below. PERMISSION_GROUPS is what actually renders the
 * checkboxes on Site Admin → Roles, so a resource only enforced here but
 * missing from PERMISSION_GROUPS is invisible to the person managing
 * rights — easy to add, easy to forget.
 */
export const statement = {
  ...defaultStatements,
  workOrder: ["create", "update", "delete"],
  invoice: ["create", "update", "void", "delete", "viewMargins"],
  inventory: ["create", "update"],
  expense: ["create", "update"],
  customer: ["create", "update"],
  report: ["view"],
  shopSettings: ["update"],
  billing: ["manage"],
} as const;

export const ac = createAccessControl(statement);

/** Owner / Super-Admin — full control, billing, user management, financial reports. Protected, hardcoded, never editable via Site Admin → Roles. */
export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
  workOrder: ["create", "update", "delete"],
  invoice: ["create", "update", "void", "delete", "viewMargins"],
  inventory: ["create", "update"],
  expense: ["create", "update"],
  customer: ["create", "update"],
  report: ["view"],
  shopSettings: ["update"],
  billing: ["manage"],
});

/** The only role Better Auth needs statically defined — see file header. */
export const STATIC_ROLES = { owner } as const;

/**
 * Better Auth's own TypeScript types for `member.role` (member/invitation
 * endpoints, both server and client) are inferred from STATIC_ROLES above,
 * so they only know about "owner". Every other role is resolved at request
 * time via dynamicAccessControl (src/lib/auth.ts), which accepts any
 * string — this cast is the sanctioned way past that static/dynamic
 * mismatch at call sites passing a role that came from listRoles()/a
 * <select>, not a hardcoded literal. Lives here (not src/lib/rbac.ts) so
 * client components can import it without pulling in rbac.ts's
 * server-only dependencies (next/headers, prisma).
 */
export function asRole(role: string) {
  return role as unknown as "owner";
}

/**
 * The business-facing subset of `statement` that Site Admin → Roles
 * actually renders as checkboxes. Deliberately excludes Better Auth's own
 * internal resources (`organization`, `team`, `ac`) — those aren't a form
 * or process a shop uses, and letting a role toggle `ac` (role management
 * itself) would let it edit its own rights. `member`/`invitation` ARE
 * included since they directly gate the Staff page's real actions (Add
 * User, Invite Staff, change role, remove).
 */
export const PERMISSION_GROUPS: {
  resource: keyof typeof statement;
  label: string;
  actions: { key: string; label: string }[];
}[] = [
  {
    resource: "workOrder",
    label: "Work Orders",
    actions: [
      { key: "create", label: "Create / intake" },
      { key: "update", label: "Edit" },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    resource: "invoice",
    label: "Invoices",
    actions: [
      { key: "create", label: "Create" },
      { key: "update", label: "Edit" },
      { key: "void", label: "Void" },
      { key: "delete", label: "Delete (drafts & voided invoices — the Owner can delete any invoice)" },
      { key: "viewMargins", label: "View profit margins" },
    ],
  },
  {
    resource: "inventory",
    label: "Inventory",
    actions: [
      { key: "create", label: "Create" },
      { key: "update", label: "Edit" },
    ],
  },
  {
    resource: "expense",
    label: "Expenses",
    actions: [
      { key: "create", label: "Create" },
      { key: "update", label: "Edit" },
    ],
  },
  {
    resource: "customer",
    label: "Customers & Equipment",
    actions: [
      { key: "create", label: "Create" },
      { key: "update", label: "Edit" },
    ],
  },
  {
    resource: "report",
    label: "Reports",
    actions: [{ key: "view", label: "View" }],
  },
  {
    resource: "shopSettings",
    label: "Shop Settings",
    actions: [{ key: "update", label: "Update (email providers, branding, tax)" }],
  },
  {
    resource: "billing",
    label: "Billing",
    actions: [{ key: "manage", label: "Manage subscription" }],
  },
  {
    resource: "member",
    label: "Staff Accounts",
    actions: [
      { key: "create", label: "Add staff directly" },
      { key: "update", label: "Change a staff member's role" },
      { key: "delete", label: "Remove staff" },
    ],
  },
  {
    resource: "invitation",
    label: "Staff Invites",
    actions: [
      { key: "create", label: "Send email invite" },
      { key: "cancel", label: "Cancel a pending invite" },
    ],
  },
];

/** Full statement keys that stay fixed (not shown in the rights editor) — see PERMISSION_GROUPS comment above. */
export const HIDDEN_RESOURCES = ["organization", "team", "ac"] as const;
