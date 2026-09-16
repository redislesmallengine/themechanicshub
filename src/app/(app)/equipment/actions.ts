"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadEquipmentPhoto, deleteImage } from "@/lib/storage";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB — same cap as the shop logo

async function requireCanManageCustomers(action: "create" | "update" = "create") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { customer: [action] } },
  });
  if (!allowed.success) throw new Error(`You don't have permission to ${action === "create" ? "register" : "edit"} equipment.`);

  return { organizationId: session.session.activeOrganizationId };
}

export async function createEquipment(customerId: string, formData: FormData) {
  const { organizationId } = await requireCanManageCustomers("create");

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };

  const equipmentTypeId = String(formData.get("equipmentTypeId") ?? "").trim() || null;
  if (equipmentTypeId) {
    const type = await prisma.equipmentType.findUnique({ where: { id: equipmentTypeId } });
    if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };
  }

  const make = String(formData.get("make") ?? "").trim();
  if (make) {
    const validMake = await prisma.equipmentMake.findUnique({ where: { organizationId_name: { organizationId, name: make } } });
    if (!validMake) return { error: `"${make}" isn't in your Equipment Makes list — add it in Settings first.` };
  }
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const engineType = String(formData.get("engineType") ?? "").trim();
  if (engineType) {
    const validEngineType = await prisma.engineType.findUnique({ where: { organizationId_name: { organizationId, name: engineType } } });
    if (!validEngineType) return { error: `"${engineType}" isn't in your Engine Types list — add it in Settings first.` };
  }
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

export async function updateEquipment(equipmentId: string, formData: FormData) {
  const { organizationId } = await requireCanManageCustomers("update");

  const existing = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!existing || existing.organizationId !== organizationId) return { error: "That equipment doesn't exist." };

  const equipmentTypeId = String(formData.get("equipmentTypeId") ?? "").trim() || null;
  if (equipmentTypeId) {
    const type = await prisma.equipmentType.findUnique({ where: { id: equipmentTypeId } });
    if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };
  }

  // Allow the field through unchanged even if it's drifted out of the
  // shop's current Make/Engine Type list (renamed elsewhere before that
  // started propagating, or set before this dropdown existed) — only a
  // genuinely new value has to match the list. Otherwise re-saving this
  // form without touching the field would fail validation on data the
  // form itself displayed as selected.
  const make = String(formData.get("make") ?? "").trim();
  if (make && make !== existing.make) {
    const validMake = await prisma.equipmentMake.findUnique({ where: { organizationId_name: { organizationId, name: make } } });
    if (!validMake) return { error: `"${make}" isn't in your Equipment Makes list — add it in Settings first.` };
  }
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const engineType = String(formData.get("engineType") ?? "").trim();
  if (engineType && engineType !== existing.engineType) {
    const validEngineType = await prisma.engineType.findUnique({ where: { organizationId_name: { organizationId, name: engineType } } });
    if (!validEngineType) return { error: `"${engineType}" isn't in your Engine Types list — add it in Settings first.` };
  }
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

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
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

  revalidatePath(`/customers/${existing.customerId}`);
  revalidatePath(`/equipment/${equipmentId}`);
  redirect(`/equipment/${equipmentId}`);
}

export async function uploadEquipmentPhotoAction(equipmentId: string, formData: FormData) {
  const { organizationId } = await requireCanManageCustomers("update");

  const existing = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!existing || existing.organizationId !== organizationId) return { error: "That equipment doesn't exist." };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose an image to upload." };
  if (!photo.type.startsWith("image/")) return { error: "Photo needs to be an image file (PNG, JPG, etc.)." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large — keep it under 4MB." };

  const key = await uploadEquipmentPhoto(organizationId, equipmentId, photo);
  await prisma.equipment.update({ where: { id: equipmentId }, data: { photoKey: key } });
  if (existing.photoKey) await deleteImage(existing.photoKey); // best-effort, after the new one is safely saved

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath(`/customers/${existing.customerId}`);
  return { success: true };
}

export async function removeEquipmentPhoto(equipmentId: string) {
  const { organizationId } = await requireCanManageCustomers("update");

  const existing = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!existing || existing.organizationId !== organizationId) return { error: "That equipment doesn't exist." };
  if (!existing.photoKey) return { success: true };

  await prisma.equipment.update({ where: { id: equipmentId }, data: { photoKey: null } });
  await deleteImage(existing.photoKey);

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath(`/customers/${existing.customerId}`);
  return { success: true };
}

// Doesn't redirect — called from both the equipment list (stays put,
// just refreshes) and the equipment detail page (navigates back to the
// customer itself) via delete-equipment-button.tsx's optional redirectTo.
export async function deleteEquipment(equipmentId: string) {
  const { organizationId } = await requireCanManageCustomers("update");

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment || equipment.organizationId !== organizationId) return { error: "That equipment doesn't exist." };

  await prisma.equipment.delete({ where: { id: equipmentId } });
  if (equipment.photoKey) await deleteImage(equipment.photoKey);

  revalidatePath(`/customers/${equipment.customerId}`);
  revalidatePath("/equipment");
  return { success: true, customerId: equipment.customerId };
}
