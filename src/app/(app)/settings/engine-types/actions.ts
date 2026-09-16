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

export async function addEngineType(formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the engine type a name." };

  const existing = await prisma.engineType.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.engineType.create({ data: { organizationId, name } });

  revalidatePath("/settings/engine-types");
  return { success: true };
}

/** Equipment.engineType is a plain string, not a foreign key — see equipment-makes/actions.ts's renameEquipmentMake for why this re-points existing rows explicitly. */
export async function renameEngineType(id: string, formData: FormData) {
  const { organizationId } = await requireCanManageShopSettings();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };

  const engineType = await prisma.engineType.findUnique({ where: { id } });
  if (!engineType || engineType.organizationId !== organizationId) return { error: "That engine type doesn't exist." };

  const clash = await prisma.engineType.findUnique({ where: { organizationId_name: { organizationId, name } } });
  if (clash && clash.id !== id) return { error: `"${name}" already exists.` };

  await prisma.$transaction([
    prisma.engineType.update({ where: { id }, data: { name } }),
    prisma.equipment.updateMany({ where: { organizationId, engineType: engineType.name }, data: { engineType: name } }),
  ]);

  revalidatePath("/settings/engine-types");
  revalidatePath("/equipment");
  return { success: true };
}

export async function deleteEngineType(id: string) {
  const { organizationId } = await requireCanManageShopSettings();

  const engineType = await prisma.engineType.findUnique({ where: { id } });
  if (!engineType || engineType.organizationId !== organizationId) return { error: "That engine type doesn't exist." };

  const inUse = await prisma.equipment.count({ where: { organizationId, engineType: engineType.name } });
  if (inUse > 0) {
    return { error: `${inUse} piece${inUse === 1 ? "" : "s"} of equipment ${inUse === 1 ? "uses" : "use"} this engine type — reassign them first.` };
  }

  await prisma.engineType.delete({ where: { id } });

  revalidatePath("/settings/engine-types");
  return { success: true };
}
