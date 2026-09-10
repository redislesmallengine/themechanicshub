"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadEquipmentPhoto, deleteImage } from "@/lib/storage";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB — same cap as the shop logo

async function requireCanManageCustomers() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { customer: ["create"] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to register equipment.");

  return { organizationId: session.session.activeOrganizationId };
}

export async function createEquipment(customerId: string, formData: FormData) {
  const { organizationId } = await requireCanManageCustomers();

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };

  const equipmentTypeId = String(formData.get("equipmentTypeId") ?? "").trim() || null;
  if (equipmentTypeId) {
    const type = await prisma.equipmentType.findUnique({ where: { id: equipmentTypeId } });
    if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };
  }

  const make = String(formData.get("make") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const engineType = String(formData.get("engineType") ?? "").trim();
  const displacement = String(formData.get("displacement") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const yearRaw = String(formData.get("year") ?? "").trim();
  let year: number | null = null;
  if (yearRaw) {
    year = Number(yearRaw);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
      return { error: `Year needs to be between 1900 and ${currentYear + 1}.` };
    }
  }

  const equipment = await prisma.equipment.create({
    data: {
      organizationId,
      customerId,
      equipmentTypeId,
      make: make || null,
      model: model || null,
      serialNumber: serialNumber || null,
      engineType: engineType || null,
      displacement: displacement || null,
      year,
      notes: notes || null,
    },
  });

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return { error: "Photo needs to be an image file (PNG, JPG, etc.)." };
    if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large — keep it under 4MB." };
    const key = await uploadEquipmentPhoto(organizationId, equipment.id, photo);
    await prisma.equipment.update({ where: { id: equipment.id }, data: { photoKey: key } });
  }

  revalidatePath(`/customers/${customerId}`);
  redirect(`/equipment/${equipment.id}`);
}

export async function deleteEquipment(equipmentId: string) {
  const { organizationId } = await requireCanManageCustomers();

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment || equipment.organizationId !== organizationId) return { error: "That equipment doesn't exist." };

  await prisma.equipment.delete({ where: { id: equipmentId } });
  if (equipment.photoKey) await deleteImage(equipment.photoKey);

  revalidatePath(`/customers/${equipment.customerId}`);
  redirect(`/customers/${equipment.customerId}`);
}
