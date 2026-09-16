"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyStockAdjustment, ADJUSTMENT_REASONS, type AdjustmentReason } from "@/lib/inventory";

async function requireCanManageInventory(action: "create" | "update" = "create") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { inventory: [action] } },
  });
  if (!allowed.success) throw new Error(`You don't have permission to ${action === "create" ? "add" : "edit"} inventory.`);

  return { organizationId: session.session.activeOrganizationId, userId: session.user.id };
}

function parseDecimal(raw: FormDataEntryValue | null, label: string): { value: string | null } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { value: null };
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return { error: `${label} needs to be a positive number.` };
  return { value: num.toFixed(2) };
}

function parsePartFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const binLocation = String(formData.get("binLocation") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Part name is required." };

  const costPrice = parseDecimal(formData.get("costPrice"), "Cost price");
  if ("error" in costPrice) return { error: costPrice.error };
  const sellPrice = parseDecimal(formData.get("sellPrice"), "Sell price");
  if ("error" in sellPrice) return { error: sellPrice.error };

  const reorderPointRaw = String(formData.get("reorderPoint") ?? "0").trim();
  const reorderPoint = Number(reorderPointRaw) || 0;
  if (!Number.isInteger(reorderPoint) || reorderPoint < 0) return { error: "Reorder point needs to be a whole number, 0 or more." };

  return {
    name,
    sku: sku || null,
    barcode: barcode || null,
    binLocation: binLocation || null,
    categoryId,
    notes: notes || null,
    costPrice: costPrice.value,
    sellPrice: sellPrice.value,
    reorderPoint,
  };
}

export async function createPart(formData: FormData) {
  const { organizationId } = await requireCanManageInventory("create");

  const fields = parsePartFields(formData);
  if ("error" in fields) return { error: fields.error };

  if (fields.categoryId) {
    const category = await prisma.partCategory.findUnique({ where: { id: fields.categoryId } });
    if (!category || category.organizationId !== organizationId) return { error: "That category doesn't exist." };
  }

  if (fields.sku) {
    const clash = await prisma.part.findUnique({ where: { organizationId_sku: { organizationId, sku: fields.sku } } });
    if (clash) return { error: `SKU "${fields.sku}" is already in use.` };
  }

  const startingQtyRaw = String(formData.get("startingQuantity") ?? "0").trim();
  const startingQuantity = Number(startingQtyRaw) || 0;
  if (!Number.isInteger(startingQuantity) || startingQuantity < 0) return { error: "Starting quantity needs to be a whole number, 0 or more." };

  const part = await prisma.part.create({ data: { organizationId, ...fields, quantityOnHand: startingQuantity } });

  if (startingQuantity > 0) {
    await prisma.partStockAdjustment.create({
      data: { partId: part.id, delta: startingQuantity, reason: "Restock", note: "Initial stock on file creation" },
    });
  }

  revalidatePath("/inventory");
  redirect(`/inventory/${part.id}`);
}

export async function updatePart(partId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInventory("update");

  const existing = await prisma.part.findUnique({ where: { id: partId } });
  if (!existing || existing.organizationId !== organizationId) return { error: "That part doesn't exist." };

  const fields = parsePartFields(formData);
  if ("error" in fields) return { error: fields.error };

  if (fields.categoryId) {
    const category = await prisma.partCategory.findUnique({ where: { id: fields.categoryId } });
    if (!category || category.organizationId !== organizationId) return { error: "That category doesn't exist." };
  }

  if (fields.sku) {
    const clash = await prisma.part.findUnique({ where: { organizationId_sku: { organizationId, sku: fields.sku } } });
    if (clash && clash.id !== partId) return { error: `SKU "${fields.sku}" is already in use.` };
  }

  await prisma.part.update({ where: { id: partId }, data: fields });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${partId}`);
  redirect(`/inventory/${partId}`);
}

export async function deletePart(partId: string) {
  const { organizationId } = await requireCanManageInventory("update");

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || part.organizationId !== organizationId) return { error: "That part doesn't exist." };

  await prisma.part.delete({ where: { id: partId } });

  revalidatePath("/inventory");
  return { success: true };
}

/**
 * The manual "Adjust Stock" form on a part's detail page. See
 * src/lib/inventory.ts's applyStockAdjustment for the actual logic — it's
 * shared with Work Orders adding/removing parts (Phase 4).
 */
export async function adjustStock(partId: string, formData: FormData) {
  const { organizationId, userId } = await requireCanManageInventory("update");

  const deltaRaw = String(formData.get("delta") ?? "").trim();
  const delta = Number(deltaRaw);

  const reason = String(formData.get("reason") ?? "").trim();
  if (!ADJUSTMENT_REASONS.includes(reason as AdjustmentReason)) return { error: "Choose a reason for the adjustment." };

  const note = String(formData.get("note") ?? "").trim();

  const result = await applyStockAdjustment({ organizationId, partId, delta, reason: reason as AdjustmentReason, note, createdByUserId: userId });
  if ("error" in result) return { error: result.error };

  revalidatePath(`/inventory/${partId}`);
  revalidatePath("/inventory");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Saved views — shop-wide filter shortcuts on the Inventory list. Not gated
// behind requireCanManageInventory("create"/"update") on purpose: viewing
// /inventory itself has no permission check either (every staff member who
// belongs to the shop can browse it), so a personal filter shortcut on top
// of that shouldn't need inventory-editing rights someone might not have.
// ---------------------------------------------------------------------------

async function requireSignedIn() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");
  return { organizationId: session.session.activeOrganizationId, userId: session.user.id };
}

export async function createSavedView(formData: FormData) {
  const { organizationId, userId } = await requireSignedIn();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give this view a name." };

  const q = String(formData.get("q") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const stock = String(formData.get("stock") ?? "").trim();
  const filters = JSON.stringify({ q: q || undefined, category: category || undefined, stock: stock || undefined });

  const existing = await prisma.savedView.findUnique({
    where: { organizationId_resource_name: { organizationId, resource: "inventory", name } },
  });
  if (existing) return { error: `A view named "${name}" already exists.` };

  await prisma.savedView.create({
    data: { organizationId, resource: "inventory", name, filters, createdByUserId: userId },
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteSavedView(viewId: string) {
  const { organizationId } = await requireSignedIn();

  const view = await prisma.savedView.findUnique({ where: { id: viewId } });
  if (!view || view.organizationId !== organizationId) return { error: "That view doesn't exist." };

  await prisma.savedView.delete({ where: { id: viewId } });

  revalidatePath("/inventory");
  return { success: true };
}
