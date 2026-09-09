import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins/organization";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { ac, ROLES, ROLE_LABELS, type RoleKey } from "@/lib/permissions";

// Hostinger Email (Titan) via SMTP — see the build plan's Stack table for why:
// free (bundled with hosting), no separate vendor account. Known sending-limit
// tradeoff is accepted for now; swapping to another SMTP provider later is a
// config change here only, nothing downstream needs to know.
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendMail(to: string, subject: string, html: string) {
  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // staff are invited by an Owner/Manager, not self-registering
    sendResetPassword: async ({ user, url }) => {
      await sendMail(
        user.email,
        "Reset your Mechanic Shop Hub password",
        `<p>Someone requested a password reset for your account.</p>
         <p><a href="${url}">Reset your password</a></p>
         <p>If this wasn't you, you can ignore this email.</p>`
      );
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
        await sendMail(
          data.email,
          `You're invited to join ${data.organization.name} on Mechanic Shop Hub`,
          `<p>${data.inviter.user.name} invited you to join <b>${data.organization.name}</b> as a <b>${roleLabel}</b>.</p>
           <p><a href="${url}">Accept the invite</a></p>`
        );
      },
    }),
  ],
});
