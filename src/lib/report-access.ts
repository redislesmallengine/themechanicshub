import { auth } from "@/lib/auth";

/** Who may open the reports, and whether they may see cost prices (which parts margin and tax credits are worked out from). */
export async function reportAccess(reqHeaders: Headers) {
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return { status: "signed-out" as const };
  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { report: ["view"] } } });
  if (!allowed.success) return { status: "forbidden" as const };
  const margins = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["viewMargins"] } } });
  return { status: "ok" as const, organizationId, canViewMargins: margins.success };
}
