import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";

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

  const roleLabel = membership ? (ROLE_LABELS[membership.role as RoleKey] ?? membership.role) : undefined;

  return (
    <AppShell user={session.user} roleLabel={roleLabel}>
      {children}
    </AppShell>
  );
}
