import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { loadEmailTemplate, renderTemplate } from "@/lib/email-templates";

/**
 * Every reason quantityOnHand is allowed to change, across every place that
 * can trigger it — the manual Adjust Stock form (Settings -> Inventory) and
 * adding/removing a part on a Work Order (Phase 4). Keep this as the single
 * list rather than letting each call site invent its own subset.
 */
export const ADJUSTMENT_REASONS = ["Restock", "Correction", "Damaged/Lost", "Return to Supplier", "Used on Work Order", "Sold on Invoice", "Other"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/**
 * The only place quantityOnHand actually changes. Every call logs a
 * PartStockAdjustment row (the audit trail Settings -> Inventory's Stock
 * History reads) and, if the change crosses the part at/under its reorder
 * point, emails the shop's Owner. Callers (src/app/(app)/inventory/
 * actions.ts's adjustStock, src/app/(app)/work-orders/actions.ts's part
 * add/remove) are responsible for their own permission checks before
 * calling this — this function trusts its inputs.
 */
export async function applyStockAdjustment(params: {
  organizationId: string;
  partId: string;
  delta: number;
  reason: AdjustmentReason;
  note?: string | null;
  createdByUserId?: string | null;
}): Promise<{ success: true; newQuantity: number } | { error: string }> {
  const { organizationId, partId, delta, reason, note, createdByUserId } = params;

  if (!Number.isInteger(delta) || delta === 0) return { error: "Enter a non-zero whole number — positive to add stock, negative to remove it." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || part.organizationId !== organizationId) return { error: "That part doesn't exist." };

  const newQuantity = part.quantityOnHand + delta;
  if (newQuantity < 0) return { error: `Not enough "${part.name}" in stock (${part.quantityOnHand} on hand).` };

  const wasAboveReorderPoint = part.quantityOnHand > part.reorderPoint;

  await prisma.$transaction([
    prisma.part.update({ where: { id: partId }, data: { quantityOnHand: newQuantity } }),
    prisma.partStockAdjustment.create({
      data: { partId, delta, reason, note: note || null, createdByUserId: createdByUserId || null },
    }),
  ]);

  if (wasAboveReorderPoint && newQuantity <= part.reorderPoint) {
    const [ownerMembership, organization] = await Promise.all([
      prisma.member.findFirst({ where: { organizationId, role: "owner" }, include: { user: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);
    if (ownerMembership) {
      const template = await loadEmailTemplate(organizationId, "lowStock");
      const data = {
        part_name: part.name,
        sku: part.sku ?? "—",
        quantity: String(newQuantity),
        reorder_point: String(part.reorderPoint),
        shop_name: organization?.name ?? "your shop",
      };
      await sendMail({
        to: ownerMembership.user.email,
        subject: renderTemplate(template.subject, data),
        html: renderTemplate(template.html, data),
        organizationId,
      }).catch(() => null); // stock update already succeeded — a failed notification email shouldn't surface as an error to the caller
    }
  }

  return { success: true, newQuantity };
}
