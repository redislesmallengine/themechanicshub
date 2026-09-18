import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins/organization";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { loadEmailTemplate, renderTemplate, EMAIL_TEMPLATE_META } from "@/lib/email-templates";
import { ac, STATIC_ROLES } from "@/lib/permissions";
import { OWNER_ROLE, seedDefaultRolesForOrg } from "@/lib/rbac";
import { seedDefaultEquipmentTypes } from "@/lib/equipment-types";
import { seedDefaultEquipmentMakes } from "@/lib/equipment-makes";
import { seedDefaultEngineTypes } from "@/lib/engine-types";
import { seedDefaultPartCategories } from "@/lib/part-categories";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  user: {
    additionalFields: {
      // Platform-level "site administrator" flag — see src/lib/rbac.ts.
      // input: false so it can never be set by a client-supplied sign-up/
      // update payload; only ever flipped by direct DB access (see
      // prisma/schema.prisma's comment on User.isSiteAdmin).
      isSiteAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // staff are invited by an Owner/Manager, not self-registering
    sendResetPassword: async ({ user, url }) => {
      // No organization context at this point in the flow — resolveConfig
      // in src/lib/email.ts falls back to the platform default provider.
      // Same for the template: no org membership yet means no per-shop
      // customization to load, so this uses the built-in default.
      const membership = await prisma.member.findFirst({ where: { userId: user.id } });
      const template = membership?.organizationId
        ? await loadEmailTemplate(membership.organizationId, "passwordReset")
        : { subject: EMAIL_TEMPLATE_META.passwordReset.defaultSubject, html: EMAIL_TEMPLATE_META.passwordReset.defaultHtml };
      const data = { user_name: user.name, reset_link: url };
      await sendMail({
        to: user.email,
        subject: renderTemplate(template.subject, data),
        html: renderTemplate(template.html, data),
        organizationId: membership?.organizationId,
      });
    },
  },

  plugins: [
    organization({
      ac,
      roles: STATIC_ROLES, // just "owner" — every other role is dynamic, see src/lib/rbac.ts
      creatorRole: "owner", // whoever signs up first for a shop becomes its Owner
      // Staff are invited, not self-registered — see AGENTS.md / build plan Phase 1.
      allowUserToCreateOrganization: true,
      // Roles beyond Owner are DB-driven (site admin's shared PlatformRole
      // library) instead of hardcoded — this is Better Auth's own built-in
      // mechanism for that; it reads the OrganizationRole table at request
      // time. src/lib/rbac.ts is what actually writes to it, since the site
      // admin managing this library isn't necessarily a member of any shop
      // (the requirement Better Auth's own create/update/delete-role
      // endpoints enforce) — this app never calls those endpoints directly.
      dynamicAccessControl: { enabled: true },
      organizationHooks: {
        // Every new shop starts with the current shared role library
        // (Manager/Technician/Bookkeeper/Front Desk, or whatever the site
        // admin has changed that to) already assignable — not just Red
        // Isle's pre-seeded set from the migration.
        afterCreateOrganization: async ({ organization }) => {
          await seedDefaultRolesForOrg(organization.id);
          await seedDefaultEquipmentTypes(organization.id);
          await seedDefaultEquipmentMakes(organization.id);
          await seedDefaultEngineTypes(organization.id);
          await seedDefaultPartCategories(organization.id);
        },
      },
      sendInvitationEmail: async (data) => {
        const url = `${process.env.BETTER_AUTH_URL}/accept-invite?id=${data.id}`;
        const roleLabel =
          data.role === "owner" ? OWNER_ROLE.label : ((await prisma.platformRole.findUnique({ where: { key: data.role } }))?.label ?? data.role);
        const template = await loadEmailTemplate(data.organization.id, "staffInvite");
        const templateData = { inviter_name: data.inviter.user.name, shop_name: data.organization.name, role_label: roleLabel, invite_link: url };
        await sendMail({
          to: data.email,
          subject: renderTemplate(template.subject, templateData),
          html: renderTemplate(template.html, templateData),
          organizationId: data.organization.id,
        });
      },
    }),
  ],
});
