import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WrenchIcon } from "@/components/icons";
import { PENDING_MESSAGE, REJECTED_MESSAGE } from "@/lib/shop-approval";
import { SignOutButton } from "@/components/sign-out-button";

// Where someone lands if they somehow hold a session for a shop that has not been approved
// (signing in is refused up front, so this is a safety net). Approved shops go straight on.
export default async function PendingApprovalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const membership = await prisma.member.findFirst({ where: { userId: session.user.id }, include: { organization: { select: { approvalStatus: true } } } });
  if (session.user.isSiteAdmin || !membership || membership.organization.approvalStatus === "approved") redirect("/dashboard");

  const rejected = membership.organization.approvalStatus === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
      <div className="w-full max-w-md rounded-xl p-8 md:p-10 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 mb-4">
          <WrenchIcon className="w-4.5 h-4.5 text-white" />
        </span>
        <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
          {rejected ? "Sign-up not approved" : "Waiting for approval"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {rejected ? REJECTED_MESSAGE : PENDING_MESSAGE}
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
