"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireCanManageShopSettings() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { shopSettings: ["update"] } } });
  if (!allowed.success) throw new Error("You don't have permission to change shop settings.");

  return { organizationId: session.session.activeOrganizationId };
}

function readService(formData: FormData): { name: string; price: string; taxable: boolean; description: string | null } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the service a name." };
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = Number(priceRaw);
  if (!priceRaw || !Number.isFinite(price) || price < 0) return { error: "Enter the price, for example 180.00." };
  return { name, price: price.toFixed(2), taxable: formData.get("taxable") === "on", description: String(formData.get("description") ?? "").trim() || null };
}

export async function addService(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };

  const existing = await prisma.service.findUnique({ where: { organizationId_name: { organizationId, name: parsed.name } } });
  if (existing) return { error: `"${parsed.name}" already exists.` };

  await prisma.service.create({ data: { organizationId, ...parsed } });
  revalidatePath("/settings/services");
  return { success: true };
}

export async function updateService(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || service.organizationId !== organizationId) return { error: "That service doesn't exist." };
  const clash = await prisma.service.findUnique({ where: { organizationId_name: { organizationId, name: parsed.name } } });
  if (clash && clash.id !== id) return { error: `"${parsed.name}" already exists.` };

  // Invoices already written keep the price they were billed at -- a line is copied onto the invoice, not linked to this record.
  await prisma.service.update({ where: { id }, data: { ...parsed, active: formData.get("active") === "on" } });
  revalidatePath("/settings/services");
  return { success: true };
}

export async function deleteService(id: string) {
  const { organizationId } = await requireCanManageShopSettings();
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || service.organizationId !== organizationId) return { error: "That service doesn't exist." };

  await prisma.service.delete({ where: { id } });
  revalidatePath("/settings/services");
  return { success: true };
}
