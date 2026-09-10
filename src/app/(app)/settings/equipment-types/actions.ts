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

export async function addEquipmentType(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the equipment type a name." };

  const existing = await prisma.equipmentType.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.equipmentType.create({ data: { organizationId, name } });

  revalidatePath("/settings/equipment-types");
  return { success: true };
}

export async function renameEquipmentType(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };

  const type = await prisma.equipmentType.findUnique({ where: { id } });
  if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };

  const clash = await prisma.equipmentType.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (clash && clash.id !== id) return { error: `"${name}" already exists.` };

  await prisma.equipmentType.update({ where: { id }, data: { name } });

  revalidatePath("/settings/equipment-types");
  return { success: true };
}

export async function deleteEquipmentType(id: string) {
  const { organizationId } = await requireCanManageShopSettings();

  const type = await prisma.equipmentType.findUnique({ where: { id } });
  if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };

  const inUse = await prisma.equipment.count({ where: { equipmentTypeId: id } });
  if (inUse > 0) {
    return { error: `${inUse} piece${inUse === 1 ? "" : "s"} of equipment ${inUse === 1 ? "uses" : "use"} this type — reassign them first.` };
  }

  await prisma.equipmentType.delete({ where: { id } });

  revalidatePath("/settings/equipment-types");
  return { success: true };
}
