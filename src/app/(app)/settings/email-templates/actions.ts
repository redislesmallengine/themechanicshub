"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  renderTemplate,
  findMissingRequiredTokens,
  saveEmailTemplateOverride,
  deleteEmailTemplateOverride,
  type EmailTemplateKey,
} from "@/lib/email-templates";

async function requireCanManageShopSettings() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to change shop settings.");

  return { organizationId: session.session.activeOrganizationId };
}

function requireValidKey(key: string): key is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export async function saveEmailTemplate(key: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();
  if (!requireValidKey(key)) return { error: "That's not a real email template." };

  const subject = String(formData.get("subject") ?? "").trim();
  const html = String(formData.get("html") ?? "").trim();
  if (!subject) return { error: "Subject can't be empty." };
  if (!html) return { error: "The email body can't be empty." };

  const missing = findMissingRequiredTokens(key, subject, html);
  if (missing.length > 0) {
    return { error: `This template must still include ${missing.map((t) => `{{${t}}}`).join(", ")} somewhere, or the email won't do what it's for.` };
  }

  await saveEmailTemplateOverride(organizationId, key, subject, html);

  revalidatePath("/settings/email-templates");
  return { success: true };
}

export async function restoreDefaultTemplate(key: string) {
  const { organizationId } = await requireCanManageShopSettings();
  if (!requireValidKey(key)) return { error: "That's not a real email template." };

  await deleteEmailTemplateOverride(organizationId, key);

  revalidatePath("/settings/email-templates");
  return { success: true };
}

/** Renders whatever draft subject/html is currently in the editor against sample data — no required-token validation here (that's a save-time check), so the preview can show exactly what's wrong if something important got deleted. */
export async function previewEmailTemplate(key: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();
  if (!requireValidKey(key)) return { error: "That's not a real email template." };

  const subject = String(formData.get("subject") ?? "");
  const html = String(formData.get("html") ?? "");

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const data = { shop_name: organization?.name ?? "Your Shop", ...EMAIL_TEMPLATE_META[key].sampleData };

  return { success: true, subject: renderTemplate(subject, data), html: renderTemplate(html, data) };
}
