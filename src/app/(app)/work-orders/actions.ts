"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { applyStockAdjustment } from "@/lib/inventory";

async function requireCanManageWorkOrders(action: "create" | "update" | "delete" = "create") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { workOrder: [action] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to do that.");

  return { organizationId: session.session.activeOrganizationId, userId: session.user.id };
}

async function loadOwnWorkOrder(workOrderId: string, organizationId: string) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder || workOrder.organizationId !== organizationId) return null;
  return workOrder;
}

export async function createWorkOrder(formData: FormData) {
  const { organizationId } = await requireCanManageWorkOrders("create");

  const customerId = String(formData.get("customerId") ?? "").trim();
  const equipmentId = String(formData.get("equipmentId") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();

  if (!customerId || !equipmentId) return { error: "Pick a customer and a piece of their equipment." };
  if (!complaint) return { error: "What's the complaint? A line or two is fine." };

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment || equipment.organizationId !== organizationId || equipment.customerId !== customerId) {
    return { error: "That equipment doesn't belong to this customer." };
  }

  // "Customer said just fix it" fast path — the common case (checkbox
  // defaults checked on the intake form). Creates the work order already
  // authorized for repair, skipping the formal estimate/approval cycle
  // entirely, while still keeping a real record of who authorized it and
  // when — see skipEstimateApproval below for the same thing done later,
  // mid-diagnosis, from the status panel instead of at intake.
  const skipEstimate = formData.get("skipEstimate") === "on";
  let notToExceedAmount: string | null = null;
  if (skipEstimate) {
    const raw = String(formData.get("notToExceedAmount") ?? "").trim();
    if (raw) {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return { error: "Not-to-exceed amount needs to be a positive number." };
      notToExceedAmount = num.toFixed(2);
    }
  }

  const workOrder = await prisma.workOrder.create({
    data: skipEstimate
      ? {
          organizationId,
          customerId,
          equipmentId,
          complaint,
          status: "inRepair",
          approvalMethod: "in-person",
          decidedByName: customer.name,
          decidedAt: new Date(),
          notToExceedAmount,
        }
      : { organizationId, customerId, equipmentId, complaint },
  });

  revalidatePath("/work-orders");
  redirect(`/work-orders/${workOrder.id}`);
}

export async function startDiagnosis(workOrderId: string) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "droppedOff") return { error: "Already past intake." };

  await prisma.workOrder.update({ where: { id: workOrderId }, data: { status: "diagnosing" } });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

export async function updateDiagnosis(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };

  const diagnosisNotes = String(formData.get("diagnosisNotes") ?? "").trim();
  const labourHoursRaw = String(formData.get("labourHours") ?? "").trim();
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "").trim() || null;

  let labourHours: string | null = null;
  if (labourHoursRaw) {
    const num = Number(labourHoursRaw);
    if (!Number.isFinite(num) || num < 0) return { error: "Labour hours needs to be a positive number." };
    labourHours = num.toFixed(2);
  }

  if (assignedToUserId) {
    const member = await prisma.member.findUnique({ where: { organizationId_userId: { organizationId, userId: assignedToUserId } } });
    if (!member) return { error: "That staff member isn't part of this shop." };
  }

  await prisma.workOrder.update({ where: { id: workOrderId }, data: { diagnosisNotes: diagnosisNotes || null, labourHours, assignedToUserId } });
  revalidatePath(`/work-orders/${workOrderId}`);
  return { success: true };
}

/** Diagnosing (or later) -> Awaiting Approval. Generates the token and emails the customer their approval link. */
export async function sendEstimate(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "droppedOff" && workOrder.status !== "diagnosing") return { error: "An estimate was already sent for this work order." };

  const amountRaw = String(formData.get("estimateAmount") ?? "").trim();
  const amount = Number(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount < 0) return { error: "Enter a valid estimate amount." };

  const estimateNotes = String(formData.get("estimateNotes") ?? "").trim();
  if (!estimateNotes) return { error: "Give the customer a plain-language line or two on what the estimate covers." };

  const token = randomBytes(24).toString("hex");

  const [customer, equipment, shop] = await Promise.all([
    prisma.customer.findUnique({ where: { id: workOrder.customerId } }),
    prisma.equipment.findUnique({ where: { id: workOrder.equipmentId }, include: { equipmentType: true } }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);
  if (!customer?.email) return { error: "This customer has no email on file — record the approval by phone instead once you've reached them." };

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: "awaitingApproval", estimateAmount: amount.toFixed(2), estimateNotes, approvalToken: token, awaitingApprovalAt: new Date() },
  });

  const url = `${process.env.BETTER_AUTH_URL}/estimate/${token}`;
  const equipmentLabel = [equipment?.make, equipment?.model].filter(Boolean).join(" ") || equipment?.equipmentType?.name || "your equipment";
  await sendMail({
    to: customer.email,
    subject: `Repair estimate for ${equipmentLabel} — ${shop?.name ?? "your shop"}`,
    html: `<p>Here's the estimate for ${equipmentLabel}:</p>
           <p><b>$${amount.toFixed(2)}</b> — ${estimateNotes}</p>
           <p><a href="${url}">Review and approve or decline</a></p>
           <p>If you'd rather talk it through, just give the shop a call.</p>`,
    organizationId,
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

/**
 * The fast path taken after intake, once the tech is already diagnosing:
 * customer said "just fix it" (in person or on a call) with no formal
 * dollar quote, so skip straight to In Repair instead of manufacturing an
 * estimate just to record approval of it. Mirrors what createWorkOrder does
 * when the same checkbox is ticked at intake instead. See
 * recordPhoneDecision below for the *other* fast path — approving/declining
 * an estimate that *was* already sent.
 */
export async function skipEstimateApproval(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "droppedOff" && workOrder.status !== "diagnosing") return { error: "This work order is already past that point." };

  const raw = String(formData.get("notToExceedAmount") ?? "").trim();
  let notToExceedAmount: string | null = null;
  if (raw) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return { error: "Not-to-exceed amount needs to be a positive number." };
    notToExceedAmount = num.toFixed(2);
  }

  const customer = await prisma.customer.findUnique({ where: { id: workOrder.customerId } });

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: "inRepair",
      approvalMethod: "in-person",
      decidedByName: customer?.name ?? "Customer",
      decidedAt: new Date(),
      notToExceedAmount,
    },
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

/** Staff-recorded phone approval/decline — the fallback for customers who call in instead of using the link. */
export async function recordPhoneDecision(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "awaitingApproval") return { error: "This work order isn't awaiting approval." };

  const decision = String(formData.get("decision") ?? "").trim();
  if (decision !== "approved" && decision !== "declined") return { error: "Choose approved or declined." };

  const decidedByName = String(formData.get("decidedByName") ?? "").trim();
  if (!decidedByName) return { error: "Who authorized this? Enter their name for the record." };

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: decision === "approved" ? "inRepair" : "declined",
      approvalMethod: "phone",
      decidedByName,
      decidedAt: new Date(),
    },
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

export async function markReadyForPickup(workOrderId: string) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "inRepair") return { error: "This work order isn't in repair." };

  await prisma.workOrder.update({ where: { id: workOrderId }, data: { status: "readyForPickup", readyForPickupAt: new Date() } });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

export async function closeWorkOrder(workOrderId: string) {
  const { organizationId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "readyForPickup") return { error: "This work order isn't ready for pickup yet." };

  await prisma.workOrder.update({ where: { id: workOrderId }, data: { status: "closed", closedAt: new Date() } });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  return { success: true };
}

/** Adding a line here immediately decrements real stock (reason "Used on Work Order") — see src/lib/inventory.ts. */
export async function addWorkOrderPart(workOrderId: string, formData: FormData) {
  const { organizationId, userId } = await requireCanManageWorkOrders("update");
  const workOrder = await loadOwnWorkOrder(workOrderId, organizationId);
  if (!workOrder) return { error: "That work order doesn't exist." };

  const partId = String(formData.get("partId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = Number(quantityRaw);
  if (!partId) return { error: "Pick a part." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Quantity needs to be a whole number greater than zero." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || part.organizationId !== organizationId) return { error: "That part doesn't exist." };

  const adjustment = await applyStockAdjustment({
    organizationId,
    partId,
    delta: -quantity,
    reason: "Used on Work Order",
    note: `Work order ${workOrderId}`,
    createdByUserId: userId,
  });
  if ("error" in adjustment) return { error: adjustment.error };

  await prisma.workOrderPart.create({
    data: { workOrderId, partId, name: part.name, quantity, unitCostPrice: part.costPrice, unitSellPrice: part.sellPrice },
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/inventory");
  return { success: true };
}

/** Removing a line restores the stock it consumed (reason "Correction"). */
export async function removeWorkOrderPart(workOrderPartId: string) {
  const { organizationId, userId } = await requireCanManageWorkOrders("update");

  const line = await prisma.workOrderPart.findUnique({ where: { id: workOrderPartId }, include: { workOrder: true } });
  if (!line || line.workOrder.organizationId !== organizationId) return { error: "That line doesn't exist." };

  if (line.partId) {
    const restore = await applyStockAdjustment({
      organizationId,
      partId: line.partId,
      delta: line.quantity,
      reason: "Correction",
      note: `Removed from work order ${line.workOrderId}`,
      createdByUserId: userId,
    });
    if ("error" in restore) return { error: restore.error };
  }

  await prisma.workOrderPart.delete({ where: { id: workOrderPartId } });

  revalidatePath(`/work-orders/${line.workOrderId}`);
  revalidatePath("/inventory");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Public — called from /estimate/[token], no session/permission involved.
// Both validate the token against a work order that's still actually
// awaiting approval, so a stale or already-used link can't do anything.
// ---------------------------------------------------------------------------

async function loadPendingByToken(token: string) {
  const workOrder = await prisma.workOrder.findUnique({ where: { approvalToken: token } });
  if (!workOrder || workOrder.status !== "awaitingApproval") return null;
  return workOrder;
}

export async function approveEstimateByToken(token: string, formData: FormData) {
  const workOrder = await loadPendingByToken(token);
  if (!workOrder) return { error: "This link is no longer valid — the estimate may have already been answered." };

  const decidedByName = String(formData.get("decidedByName") ?? "").trim();
  if (!decidedByName) return { error: "Enter your name to confirm." };

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { status: "inRepair", approvalMethod: "link", decidedByName, decidedAt: new Date() },
  });
  return { success: true };
}

export async function declineEstimateByToken(token: string, formData: FormData) {
  const workOrder = await loadPendingByToken(token);
  if (!workOrder) return { error: "This link is no longer valid — the estimate may have already been answered." };

  const decidedByName = String(formData.get("decidedByName") ?? "").trim();
  if (!decidedByName) return { error: "Enter your name to confirm." };

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { status: "declined", approvalMethod: "link", decidedByName, decidedAt: new Date() },
  });
  return { success: true };
}
