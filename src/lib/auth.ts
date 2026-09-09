import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins/organization";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { ac, ROLES, ROLE_LABELS, type RoleKey } from "@/lib/permissions";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // staff are invited by an Owner/Manager, not self-registering
    sendResetPassword: async ({ user, url }) => {
      // No organization context at this point in the flow — resolveConfig
      // in src/lib/email.ts falls back to the platform default provider.
      const membership = await prisma.member.findFirst({ where: { userId: user.id } });
      await sendMail({
        to: user.email,
        subject: "Reset your Mechanic Shop Hub password",
        html: `<p>Someone requested a password reset for your account.</p>
               <p><a href="${url}">Reset your password</a></p>
               <p>If this wasn't you, you can ignore this email.</p>`,
        organizationId: membership?.organizationId,
      });
    },
  },

  plugins: [
    organization({
      ac,
      roles: ROLES,
      creatorRole: "owner", // whoever signs up first for a shop becomes its Owner
      // Staff are invited, not self-registered — see AGENTS.md / build plan Phase 1.
      allowUserToCreateOrganization: true,
      sendInvitationEmail: async (data) => {
        const url = `${process.env.BETTER_AUTH_URL}/accept-invite?id=${data.id}`;
        const roleLabel = ROLE_LABELS[data.role as RoleKey] ?? data.role;
        await sendMail({
          to: data.email,
          subject: `You're invited to join ${data.organization.name} on Mechanic Shop Hub`,
          html: `<p>${data.inviter.user.name} invited you to join <b>${data.organization.name}</b> as a <b>${roleLabel}</b>.</p>
                 <p><a href="${url}">Accept the invite</a></p>`,
          organizationId: data.organization.id,
        });
      },
    }),
  ],
});
