"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/rbac";
import { notifyOwnerOfDecision } from "@/lib/shop-approval";

/** Opens a shop that is waiting (or was turned down) so its people can sign in. */
export async function approveShop(organizationId: string) {
  await requireSiteAdmin();
  const shop = await prisma.organization.findUnique({ where: { id: organizationId }, select: { approvalStatus: true } });
  if (!shop) return { error: "That shop doesn't exist." };
  if (shop.approvalStatus === "approved") return { success: true };

  await prisma.organization.update({ where: { id: organizationId }, data: { approvalStatus: "approved", approvedAt: new Date(), approvalNote: null } });
  await notifyOwnerOfDecision(organizationId, "approved", null);

  revalidatePath("/admin/shops");
  return { success: true };
}

/** Turns a waiting shop down. Only shops that are still pending can be rejected -- an approved shop is already in use. */
export async function rejectShop(organizationId: string, note: string) {
  await requireSiteAdmin();
  const shop = await prisma.organization.findUnique({ where: { id: organizationId }, select: { approvalStatus: true } });
  if (!shop) return { error: "That shop doesn't exist." };
  if (shop.approvalStatus === "approved") return { error: "This shop is already approved and in use, so it can't be rejected here." };

  const cleanNote = note.trim() || null;
  await prisma.organization.update({ where: { id: organizationId }, data: { approvalStatus: "rejected", approvedAt: null, approvalNote: cleanNote } });
  await notifyOwnerOfDecision(organizationId, "rejected", cleanNote);

  revalidatePath("/admin/shops");
  return { success: true };
}
