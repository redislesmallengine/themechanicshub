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

export async function addEquipmentMake(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the make a name." };

  const existing = await prisma.equipmentMake.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.equipmentMake.create({ data: { organizationId, name } });

  revalidatePath("/settings/equipment-makes");
  return { success: true };
}

/**
 * Equipment.make is a plain string, not a foreign key (see schema comment
 * on EquipmentMake) -- so a rename here doesn't automatically follow
 * through the way it would with a real relation. Explicitly re-pointing
 * every Equipment row that had the old name is what makes a rename here
 * behave the way EquipmentType's does, without the relation itself.
 */
export async function renameEquipmentMake(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };

  const make = await prisma.equipmentMake.findUnique({ where: { id } });
  if (!make || make.organizationId !== organizationId) return { error: "That make doesn't exist." };

  const clash = await prisma.equipmentMake.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (clash && clash.id !== id) return { error: `"${name}" already exists.` };

  await prisma.$transaction([
    prisma.equipmentMake.update({ where: { id }, data: { name } }),
    prisma.equipment.updateMany({ where: { organizationId, make: make.name }, data: { make: name } }),
  ]);

  revalidatePath("/settings/equipment-makes");
  revalidatePath("/equipment");
  return { success: true };
}

export async function deleteEquipmentMake(id: string) {
  const { organizationId } = await requireCanManageShopSettings();

  const make = await prisma.equipmentMake.findUnique({ where: { id } });
  if (!make || make.organizationId !== organizationId) return { error: "That make doesn't exist." };

  const inUse = await prisma.equipment.count({ where: { organizationId, make: make.name } });
  if (inUse > 0) {
    return { error: `${inUse} piece${inUse === 1 ? "" : "s"} of equipment ${inUse === 1 ? "uses" : "use"} this make — reassign them first.` };
  }

  await prisma.equipmentMake.delete({ where: { id } });

  revalidatePath("/settings/equipment-makes");
  return { success: true };
}
