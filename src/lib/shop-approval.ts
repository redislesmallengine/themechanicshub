import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";

// A new shop can not be signed in to until the site administrator approves it. These are
// the pieces shared by the sign-in check, sign-up, and the approvals page.

export const PENDING_MESSAGE = "Your shop is waiting for approval. You'll get an email as soon as it's approved, and then you can sign in.";
export const REJECTED_MESSAGE = "Your shop's sign-up wasn't approved. Please contact support if you think this is a mistake.";

export type ApprovalStatus = "pending" | "approved" | "rejected";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appUrl() {
  return process.env.BETTER_AUTH_URL ?? "";
}

/**
 * Why this person may not sign in yet, or null when they may. Site administrators always
 * can. Someone with no shop yet can too (they are mid sign-up or about to accept an invite).
 * Everyone else needs at least one approved shop.
 */
export async function signInBlockReason(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSiteAdmin: true } });
  if (user?.isSiteAdmin) return null;

  const memberships = await prisma.member.findMany({ where: { userId }, select: { organization: { select: { approvalStatus: true } } } });
  if (memberships.length === 0) return null;
  if (memberships.some((m) => m.organization.approvalStatus === "approved")) return null;
  return memberships.some((m) => m.organization.approvalStatus === "pending") ? PENDING_MESSAGE : REJECTED_MESSAGE;
}

/** Tells every site administrator a shop is waiting. A failed email never blocks the sign-up itself. */
export async function notifySiteAdminsOfNewShop(shop: { name: string; ownerName: string; ownerEmail: string }) {
  const admins = await prisma.user.findMany({ where: { isSiteAdmin: true }, select: { email: true } });
  await Promise.all(
    admins.map((admin) =>
      sendMail({
        to: admin.email,
        subject: `New shop waiting for approval: ${shop.name}`,
        html: `<p>A new shop signed up and is waiting for your approval.</p>
<p><b>${escapeHtml(shop.name)}</b><br>Owner: ${escapeHtml(shop.ownerName)} (${escapeHtml(shop.ownerEmail)})</p>
<p><a href="${appUrl()}/admin/shops">Review it in Shop Approvals</a></p>`,
      }).catch(() => null)
    )
  );
}

/** Emails the shop's owner the decision. A failed email never undoes the decision. */
export async function notifyOwnerOfDecision(organizationId: string, decision: "approved" | "rejected", note: string | null) {
  const [organization, owner] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.member.findFirst({ where: { organizationId, role: "owner" }, include: { user: true } }),
  ]);
  if (!organization || !owner) return;

  const html =
    decision === "approved"
      ? `<p>Hi ${escapeHtml(owner.user.name)},</p><p><b>${escapeHtml(organization.name)}</b> has been approved. You can sign in now.</p><p><a href="${appUrl()}/sign-in">Sign in to Mechanic Shop Hub</a></p>`
      : `<p>Hi ${escapeHtml(owner.user.name)},</p><p>Your sign-up for <b>${escapeHtml(organization.name)}</b> wasn't approved.</p>${note ? `<p>${escapeHtml(note)}</p>` : ""}<p>If you think this is a mistake, just reply to this email.</p>`;

  await sendMail({
    to: owner.user.email,
    subject: decision === "approved" ? `${organization.name} is approved` : `About your sign-up for ${organization.name}`,
    html,
  }).catch(() => null);
}
