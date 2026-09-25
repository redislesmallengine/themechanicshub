"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadLogo, deleteImage } from "@/lib/storage";

const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4MB — well under the 5mb server-action body limit (next.config.ts) once multipart overhead is accounted for

async function requireCanManageShopSettings() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { shopSettings: ["update"] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to change shop settings.");

  return { organizationId: session.session.activeOrganizationId, reqHeaders };
}

/**
 * Parses a decimal form field into what Prisma's Decimal columns want (a
 * string). `required: true` rejects blank — matches the `required`
 * attribute on the corresponding input in shop-profile-form.tsx; both
 * exist because the HTML attribute alone doesn't stop a direct action
 * call, and this is the actual enforcement.
 */
function parseDecimal(raw: FormDataEntryValue | null, label: string, required: boolean): { value: string | null } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return required ? { error: `${label} is required.` } : { value: null };
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return { error: `${label} needs to be a positive number.` };
  return { value: num.toFixed(2) };
}

/** Optional URL field — blank stays blank; a bare domain like "facebook.com/myshop" gets "https://" prepended rather than saved as a broken link. */
function normalizeUrl(raw: FormDataEntryValue | null): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

/** Optional email field — blank stays blank, otherwise needs to at least look like an address. */
function parseOptionalEmail(raw: FormDataEntryValue | null, label: string): { value: string | null } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { value: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { error: `${label} doesn't look like a valid email address.` };
  return { value: text };
}

export async function saveShopProfile(formData: FormData) {
  const { organizationId, reqHeaders } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Shop name is required." };

  const address = String(formData.get("address") ?? "").trim();
  if (!address) return { error: "Address is required." };
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Phone is required." };
  const taxLabel = String(formData.get("taxLabel") ?? "").trim();
  if (!taxLabel) return { error: "Tax label is required." };
  const province = String(formData.get("province") ?? "").trim();
  if (!province) return { error: "Province is required." };

  const labourRate = parseDecimal(formData.get("labourRate"), "Labour rate", true);
  if ("error" in labourRate) return { error: labourRate.error };
  const diagnosticFee = parseDecimal(formData.get("diagnosticFee"), "Diagnostic fee", true);
  if ("error" in diagnosticFee) return { error: diagnosticFee.error };
  const taxRate = parseDecimal(formData.get("taxRate"), "Tax rate", true);
  if ("error" in taxRate) return { error: taxRate.error };

  const agingAlertDaysRaw = String(formData.get("agingAlertDays") ?? "14").trim();
  const agingAlertDays = Number(agingAlertDaysRaw);
  if (!Number.isInteger(agingAlertDays) || agingAlertDays < 1) return { error: "Aging alert threshold needs to be a whole number of days, 1 or more." };

  const facebookUrl = normalizeUrl(formData.get("facebookUrl"));
  const googleReviewUrl = normalizeUrl(formData.get("googleReviewUrl"));
  const hstNumber = String(formData.get("hstNumber") ?? "").trim();
  const website = normalizeUrl(formData.get("website"));

  const shopEmail = parseOptionalEmail(formData.get("email"), "Shop email");
  if ("error" in shopEmail) return { error: shopEmail.error };

  const invoiceReplyToEmail = parseOptionalEmail(formData.get("invoiceReplyToEmail"), "Reply-To Email Address for Invoice");
  if ("error" in invoiceReplyToEmail) return { error: invoiceReplyToEmail.error };

  // Organization.name is Better Auth's own field (organization plugin) —
  // update it there rather than duplicating a name column on ShopProfile.
  // Better Auth checks its own "organization:update" permission on top of
  // the shopSettings check above (a custom role could have one but not the
  // other), so this can throw even after requireCanManageShopSettings()
  // passed — catch it rather than let it surface as an unhandled 500.
  try {
    const updateResult = await auth.api.updateOrganization({
      headers: reqHeaders,
      body: { organizationId, data: { name } },
    });
    if (!updateResult) return { error: "Couldn't update the shop name." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't update the shop name." };
  }

  await prisma.shopProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      address: address || null,
      phone: phone || null,
      email: shopEmail.value,
      website,
      labourRate: labourRate.value,
      diagnosticFee: diagnosticFee.value,
      taxRate: taxRate.value,
      taxLabel: taxLabel || null,
      province: province || null,
      agingAlertDays,
      facebookUrl,
      googleReviewUrl,
      hstNumber: hstNumber || null,
      invoiceReplyToEmail: invoiceReplyToEmail.value,
    },
    update: {
      address: address || null,
      phone: phone || null,
      labourRate: labourRate.value,
      diagnosticFee: diagnosticFee.value,
      taxRate: taxRate.value,
      taxLabel: taxLabel || null,
      province: province || null,
      agingAlertDays,
      facebookUrl,
      googleReviewUrl,
      hstNumber: hstNumber || null,
      invoiceReplyToEmail: invoiceReplyToEmail.value,
      email: shopEmail.value,
      website,
    },
  });

  revalidatePath("/settings/shop");
  return { success: true };
}

export async function uploadShopLogo(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { error: "Logo needs to be an image file (PNG, JPG, etc.)." };
  if (file.size > MAX_LOGO_BYTES) return { error: "That image is too large — keep it under 4MB." };

  const existing = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { logoKey: true } });

  const key = await uploadLogo(organizationId, file);

  await prisma.shopProfile.upsert({
    where: { organizationId },
    create: { organizationId, logoKey: key },
    update: { logoKey: key },
  });

  if (existing?.logoKey) await deleteImage(existing.logoKey); // best-effort, after the new one is safely saved

  revalidatePath("/settings/shop");
  return { success: true };
}

export async function removeShopLogo() {
  const { organizationId } = await requireCanManageShopSettings();

  const existing = await prisma.shopProfile.findUnique({ where: { organizationId }, select: { logoKey: true } });
  if (!existing?.logoKey) return { success: true };

  await prisma.shopProfile.update({ where: { organizationId }, data: { logoKey: null } });
  await deleteImage(existing.logoKey);

  revalidatePath("/settings/shop");
  return { success: true };
}
