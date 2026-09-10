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

export async function addPartCategory(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the category a name." };

  const existing = await prisma.partCategory.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.partCategory.create({ data: { organizationId, name } });

  revalidatePath("/settings/part-categories");
  return { success: true };
}

export async function renamePartCategory(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };

  const category = await prisma.partCategory.findUnique({ where: { id } });
  if (!category || category.organizationId !== organizationId) return { error: "That category doesn't exist." };

  const clash = await prisma.partCategory.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (clash && clash.id !== id) return { error: `"${name}" already exists.` };

  await prisma.partCategory.update({ where: { id }, data: { name } });

  revalidatePath("/settings/part-categories");
  return { success: true };
}

export async function deletePartCategory(id: string) {
  const { organizationId } = await requireCanManageShopSettings();

  const category = await prisma.partCategory.findUnique({ where: { id } });
  if (!category || category.organizationId !== organizationId) return { error: "That category doesn't exist." };

  const inUse = await prisma.part.count({ where: { categoryId: id } });
  if (inUse > 0) {
    return { error: `${inUse} part${inUse === 1 ? "" : "s"} ${inUse === 1 ? "uses" : "use"} this category — reassign them first.` };
  }

  await prisma.partCategory.delete({ where: { id } });

  revalidatePath("/settings/part-categories");
  return { success: true };
}
