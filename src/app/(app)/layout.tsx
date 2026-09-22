import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { OWNER_ROLE } from "@/lib/rbac";

// Real enforcement lives here, in the Server Component — not in proxy.ts.
// Per Next.js's own guidance (node_modules/next/dist/docs .../proxy.md):
// a Proxy matcher can silently stop covering a route after a refactor, so
// authentication must be checked again at the point that actually renders
// or mutates data, not just at the edge.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/sign-in");
  }

  // Defensive auto-heal: every page under here assumes an active
  // organization exists on the session (staff list, invites, and every
  // later phase's data all scope by it). It's supposed to be set
  // automatically when an org is created or joined, but a signup-flow bug
  // showed that side effect isn't fully reliable — so recover here instead
  // of letting downstream pages throw "No active organization".
  let membership = null;
  if (!session.session.activeOrganizationId) {
    membership = await prisma.member.findFirst({ where: { userId: session.user.id } });
    if (membership) {
      await auth.api.setActiveOrganization({
        headers: reqHeaders,
        body: { organizationId: membership.organizationId },
      });
    }
  } else {
    membership = await prisma.member.findFirst({ where: { userId: session.user.id } });
  }

  let roleLabel: string | undefined;
  if (membership) {
    roleLabel =
      membership.role === "owner"
        ? OWNER_ROLE.label
        : ((await prisma.platformRole.findUnique({ where: { key: membership.role } }))?.label ?? membership.role);
  }

  // Permission-driven, not a hardcoded role-name check — a site admin can
  // change what Manager (or any role) is allowed to do at any time, and
  // this should follow that immediately rather than only recognizing the
  // two role names that happened to have it when this was written.
  const canManageSettings = membership
    ? (await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { shopSettings: ["update"] } } })).success
    : false;
  const canViewReports = membership ? (await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { report: ["view"] } } })).success : false;

  return (
    <AppShell user={session.user} roleLabel={roleLabel} canManageSettings={canManageSettings} canViewReports={canViewReports} isSiteAdmin={session.user.isSiteAdmin ?? false}>
      {children}
    </AppShell>
  );
}
