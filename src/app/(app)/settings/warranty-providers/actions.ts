"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function addWarrantyProvider(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the warranty provider a name." };
  const billingEmail = String(formData.get("billingEmail") ?? "").trim() || null;
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;

  const existing = await prisma.warrantyProvider.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.warrantyProvider.create({ data: { organizationId, name, billingEmail, billingAddress } });

  revalidatePath("/settings/warranty-providers");
  return { success: true };
}

export async function updateWarrantyProvider(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };
  const billingEmail = String(formData.get("billingEmail") ?? "").trim() || null;
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;

  const provider = await prisma.warrantyProvider.findUnique({ where: { id } });
  if (!provider || provider.organizationId !== organizationId) return { error: "That warranty provider doesn't exist." };

  const clash = await prisma.warrantyProvider.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (clash && clash.id !== id) return { error: `"${name}" already exists.` };

  await prisma.warrantyProvider.update({ where: { id }, data: { name, billingEmail, billingAddress } });

  revalidatePath("/settings/warranty-providers");
  return { success: true };
}

export async function deleteWarrantyProvider(id: string) {
  const { organizationId } = await requireCanManageShopSettings();

  const provider = await prisma.warrantyProvider.findUnique({ where: { id } });
  if (!provider || provider.organizationId !== organizationId) return { error: "That warranty provider doesn't exist." };

  const inUse = await prisma.invoice.count({ where: { warrantyProviderId: id } });
  if (inUse > 0) {
    return { error: `${inUse} invoice${inUse === 1 ? "" : "s"} ${inUse === 1 ? "bills" : "bill"} this provider — reassign them first.` };
  }

  await prisma.warrantyProvider.delete({ where: { id } });

  revalidatePath("/settings/warranty-providers");
  return { success: true };
}
