/**
 * Mechanic Shop Hub — role & permission matrix.
 *
 * Five roles, defined once here, used by Better Auth's organization plugin
 * (src/lib/auth.ts) and referenced from the UI to decide what to render.
 *
 * Source of truth: SAAS ARCHITECTURE.docx (original spec) + build plan Phase 1.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Every permission this app cares about, grouped by resource. `defaultStatements`
 * (organization/member/invitation/team/ac) come from Better Auth's organization
 * plugin itself — merging them in means our custom roles below still satisfy
 * the plugin's own internal checks (e.g. "can this role invite a member").
 * Individual phases will grow the business-domain half of this list as their
 * features land (invoices, inventory, reports, etc.) — Phase 1 seeds it with
 * what's known today.
 */
export const statement = {
  ...defaultStatements,
  workOrder: ["create", "update", "delete"],
  invoice: ["create", "update", "void", "viewMargins"],
  inventory: ["create", "update"],
  expense: ["create", "update"],
  customer: ["create", "update"],
  report: ["view"],
  shopSettings: ["update"],
  billing: ["manage"],
} as const;

export const ac = createAccessControl(statement);

/** Owner / Super-Admin — full control, billing, user management, financial reports. */
export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
  workOrder: ["create", "update", "delete"],
  invoice: ["create", "update", "void", "viewMargins"],
  inventory: ["create", "update"],
  expense: ["create", "update"],
  customer: ["create", "update"],
  report: ["view"],
  shopSettings: ["update"],
  billing: ["manage"],
});

/** Shop Manager / Admin — full operational control; not billing, can't delete the org. */
export const manager = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["read"],
  workOrder: ["create", "update", "delete"],
  invoice: ["create", "update", "void", "viewMargins"],
  inventory: ["create", "update"],
  expense: ["create", "update"],
  customer: ["create", "update"],
  report: ["view"],
  shopSettings: ["update"],
  billing: [],
});

/**
 * Technician / Mechanic — create/edit work orders, invoices, parts lookup;
 * blocked from voiding invoices, settings, profit margins, and staff management.
 */
export const technician = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  workOrder: ["create", "update"],
  invoice: ["create", "update"],
  inventory: ["create", "update"],
  expense: [],
  customer: ["create", "update"],
  report: [],
  shopSettings: [],
  billing: [],
});

/**
 * Bookkeeper — invoices, payments, expenses, receipt OCR, tax reports;
 * blocked from shop-floor workflows and staff management.
 */
export const bookkeeper = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  workOrder: [],
  invoice: ["update", "viewMargins"],
  inventory: [],
  expense: ["create", "update"],
  customer: [],
  report: ["view"],
  shopSettings: [],
  billing: [],
});

/** Read-Only / Front Desk — customer status + equipment intake lookup only. */
export const frontdesk = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  workOrder: ["create"], // intake only — capturing drop-offs, not editing repairs
  invoice: [],
  inventory: [],
  expense: [],
  customer: ["create", "update"],
  report: [],
  shopSettings: [],
  billing: [],
});

/** Role keys as stored on the Better Auth `member.role` column. */
export const ROLES = {
  owner,
  manager,
  technician,
  bookkeeper,
  frontdesk,
} as const;

export type RoleKey = keyof typeof ROLES;

/** Human-readable labels for the UI (invite form, staff list, etc.). */
export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Owner / Super-Admin",
  manager: "Shop Manager",
  technician: "Technician / Mechanic",
  bookkeeper: "Bookkeeper",
  frontdesk: "Read-Only / Front Desk",
};
