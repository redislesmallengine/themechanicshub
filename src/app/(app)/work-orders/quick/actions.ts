"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimInvoiceNumber, generateViewToken, computeTotals, classifyInvoiceType, PAYMENT_METHODS } from "@/lib/invoices";
import { applyStockAdjustment } from "@/lib/inventory";
import { readFeeOptions, buildWorkOrderInvoiceLines } from "@/lib/invoice-lines";
import { sendInvoice } from "@/app/(app)/invoices/actions";

async function can(resource: "workOrder" | "invoice" | "customer", action: "create" | "update") {
  const result = await auth.api.hasPermission({ headers: await headers(), body: { permissions: { [resource]: [action] } } });
  return result.success;
}

/**
 * Quick Job -- a job that starts and finishes at the counter, recorded on one screen.
 * Each tick box is a step that has already happened; saving takes the work order as far as
 * the last tick and records everything on the way, exactly as clicking through the steps
 * would have (same statuses, timestamps, invoice numbering and stock use):
 *
 *   nothing ticked  -> Pending            Diagnosed -> Diagnosing
 *   OK'd            -> In Repair (go-ahead recorded in person)
 *   Repaired        -> Repair Completed   Billed -> + an invoice
 *   Paid            -> invoice paid       Picked up -> Closed
 *
 * Paid and Picked up both follow Billed but not each other, so a customer can take the
 * machine and pay later. Customer and equipment can be created in the same save.
 */
export async function createQuickJob(formData: FormData) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) throw new Error("Not signed in to a shop.");
  const userId = session.user.id;

  const tick = (name: string) => formData.get(name) === "on";
  const diagnosed = tick("step_diagnosed");
  const approved = tick("step_approved");
  const repaired = tick("step_repaired");
  const billed = tick("step_billed");
  const paid = tick("step_paid");
  const pickedUp = tick("step_pickedUp");

  // The screen keeps these consistent; this guards against a hand-built request.
  if ((approved && !diagnosed) || (repaired && !approved) || (billed && !repaired) || ((paid || pickedUp) && !billed)) {
    return { error: "A later step is ticked without the steps before it. Tick them in order." };
  }

  // Permissions: creating needs create; moving past Pending is a status change (update); each money step needs its own right.
  if (!(await can("workOrder", "create"))) return { error: "You don't have permission to create work orders." };
  if (diagnosed && !(await can("workOrder", "update"))) return { error: "You don't have permission to update work orders." };
  if (billed && !(await can("invoice", "create"))) return { error: "You don't have permission to create invoices." };
  if (paid && !(await can("invoice", "update"))) return { error: "You don't have permission to record payments." };

  const complaint = String(formData.get("complaint") ?? "").trim();
  if (!complaint) return { error: "What's the complaint? A line or two is fine." };

  // ---- customer
  const customerMode = String(formData.get("customerMode") ?? "existing");
  let customerId = String(formData.get("customerId") ?? "").trim();
  let newCustomer: { name: string; phone: string | null; email: string | null } | null = null;
  let customerName = "Customer";
  let customerEmail: string | null = null;
  if (customerMode === "new") {
    if (!(await can("customer", "create"))) return { error: "You don't have permission to register customers." };
    const name = String(formData.get("newCustomerName") ?? "").trim();
    const phone = String(formData.get("newCustomerPhone") ?? "").trim();
    const email = String(formData.get("newCustomerEmail") ?? "").trim();
    if (!name) return { error: "Customer name is required." };
    if (!phone && !email) return { error: "At least a phone number or email is required for a new customer." };
    newCustomer = { name, phone: phone || null, email: email || null };
    customerName = name;
    customerEmail = email || null;
  } else {
    if (!customerId) return { error: "Pick a customer, or register a new one." };
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };
    customerName = customer.name;
    customerEmail = customer.email;
  }

  // ---- equipment
  const equipmentMode = customerMode === "new" ? "new" : String(formData.get("equipmentMode") ?? "existing");
  let equipmentId = String(formData.get("equipmentId") ?? "").trim();
  let newEquipment: { equipmentTypeId: string | null; make: string | null; model: string | null; serialNumber: string | null } | null = null;
  if (equipmentMode === "new") {
    if (!(await can("customer", "create"))) return { error: "You don't have permission to register equipment." };
    const equipmentTypeId = String(formData.get("newEquipmentTypeId") ?? "").trim() || null;
    if (equipmentTypeId) {
      const type = await prisma.equipmentType.findUnique({ where: { id: equipmentTypeId } });
      if (!type || type.organizationId !== organizationId) return { error: "That equipment type doesn't exist." };
    }
    const make = String(formData.get("newEquipmentMake") ?? "").trim();
    if (make) {
      const validMake = await prisma.equipmentMake.findUnique({ where: { organizationId_name: { organizationId, name: make } } });
      if (!validMake) return { error: `"${make}" isn't in your Equipment Makes list — add it in Settings first.` };
    }
    const model = String(formData.get("newEquipmentModel") ?? "").trim();
    const serialNumber = String(formData.get("newEquipmentSerial") ?? "").trim();
    if (!equipmentTypeId && !make && !model && !serialNumber) return { error: "Tell us a little about the machine: a type, make, model or serial number." };
    newEquipment = { equipmentTypeId, make: make || null, model: model || null, serialNumber: serialNumber || null };
  } else {
    if (!equipmentId) return { error: "Pick the equipment, or add it as new." };
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment || equipment.organizationId !== organizationId || equipment.customerId !== customerId) return { error: "That equipment doesn't belong to this customer." };
  }

  // ---- what happened
  let assignedToUserId: string | null = null;
  let labourHours: string | null = null;
  let diagnosisNotes: string | null = null;
  if (diagnosed) {
    assignedToUserId = String(formData.get("assignedToUserId") ?? "").trim() || null;
    if (assignedToUserId) {
      const member = await prisma.member.findUnique({ where: { organizationId_userId: { organizationId, userId: assignedToUserId } } });
      if (!member) return { error: "That staff member isn't part of this shop." };
    }
    const hoursRaw = String(formData.get("labourHours") ?? "").trim();
    if (hoursRaw) {
      const num = Number(hoursRaw);
      if (!Number.isFinite(num) || num < 0) return { error: "Labour hours needs to be a positive number." };
      labourHours = num.toFixed(2);
    }
    diagnosisNotes = String(formData.get("diagnosisNotes") ?? "").trim() || null;
  }

  let notToExceedAmount: string | null = null;
  if (approved) {
    const raw = String(formData.get("notToExceedAmount") ?? "").trim();
    if (raw) {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return { error: "Not-to-exceed amount needs to be a positive number." };
      notToExceedAmount = num.toFixed(2);
    }
  }

  const repairNotes = repaired ? String(formData.get("repairNotes") ?? "").trim() || null : null;

  // Parts used (only meaningful once repaired): checked against stock now, deducted after the job is saved.
  const partRows: { partId: string; name: string; quantity: number; unitCostPrice: string | null; unitSellPrice: string | null }[] = [];
  if (repaired) {
    let requested: { partId: string; quantity: number }[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("parts") ?? "[]"));
      if (Array.isArray(parsed)) requested = parsed.map((p) => ({ partId: String(p.partId), quantity: Number(p.quantity) }));
    } catch {
      return { error: "The parts list couldn't be read. Remove and re-add the parts." };
    }
    const wanted = new Map<string, number>();
    for (const item of requested) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) return { error: "Each part's quantity needs to be a whole number greater than zero." };
      wanted.set(item.partId, (wanted.get(item.partId) ?? 0) + item.quantity);
    }
    for (const [partId, quantity] of wanted) {
      const part = await prisma.part.findUnique({ where: { id: partId } });
      if (!part || part.organizationId !== organizationId) return { error: "One of the parts doesn't exist." };
      if (quantity > part.quantityOnHand) return { error: `Not enough "${part.name}" in stock (${part.quantityOnHand} on hand).` };
      partRows.push({ partId, name: part.name, quantity, unitCostPrice: part.costPrice?.toString() ?? null, unitSellPrice: part.sellPrice?.toString() ?? null });
    }
  }

  // Money
  let fees: { includeDiagnosticFee: boolean; deliveryFee: number | null } = { includeDiagnosticFee: false, deliveryFee: null };
  let paymentMethod = "";
  let paymentReference: string | null = null;
  if (billed) {
    const parsedFees = readFeeOptions(formData);
    if ("error" in parsedFees) return { error: parsedFees.error };
    fees = parsedFees;
  }
  if (paid) {
    paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
    if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) return { error: "Choose how the customer paid before saving a paid job." };
    paymentReference = String(formData.get("paymentReference") ?? "").trim() || null;
  }

  const shopProfile = billed ? await prisma.shopProfile.findUnique({ where: { organizationId } }) : null;

  const status = pickedUp ? "closed" : repaired ? "readyForPickup" : approved ? "inRepair" : diagnosed ? "diagnosing" : "droppedOff";
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    if (newCustomer) {
      const customer = await tx.customer.create({ data: { organizationId, ...newCustomer } });
      customerId = customer.id;
    }
    if (newEquipment) {
      const equipment = await tx.equipment.create({ data: { organizationId, customerId, ...newEquipment } });
      equipmentId = equipment.id;
    }

    const workOrder = await tx.workOrder.create({
      data: {
        organizationId,
        customerId,
        equipmentId,
        complaint,
        dropOffMethod: "customerDropOff",
        // A quick job has no written-estimate step.
        preApprovalRequired: false,
        notToExceedAmount,
        status,
        diagnosisNotes,
        labourHours,
        assignedToUserId,
        repairNotes,
        ...(approved ? { approvalMethod: "in-person", decidedByName: customerName, decidedAt: now } : {}),
        ...(repaired ? { readyForPickupAt: now } : {}),
        ...(pickedUp ? { closedAt: now } : {}),
        parts: { create: partRows },
      },
    });

    let invoiceId: string | null = null;
    if (billed) {
      const lines = buildWorkOrderInvoiceLines({ labourHours, parts: partRows }, shopProfile, fees);
      const totals = computeTotals(
        lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })),
        Number(shopProfile?.taxRate ?? 0)
      );
      const invoiceNumber = await claimInvoiceNumber(tx, organizationId);
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          customerId,
          equipmentId,
          invoiceType: classifyInvoiceType({ hasEquipment: true, hasWorkOrder: true, lineItems: lines.map((l) => ({ type: l.type })) }),
          invoiceNumber,
          viewToken: generateViewToken(),
          ...(paid ? { status: "paid", paidAt: now, paymentMethod, paymentReference } : {}),
          notes: repairNotes,
          ...totals,
          lineItems: { create: lines },
        },
      });
      invoiceId = invoice.id;
    }
    return { workOrderId: workOrder.id, invoiceId };
  });

  // Stock for the parts used, the same way adding a part to a job does it. The job is already
  // saved and the quantities were checked above, so a failure here is reported, not rolled back.
  let warning: string | null = null;
  for (const part of partRows) {
    const adjustment = await applyStockAdjustment({
      organizationId,
      partId: part.partId,
      delta: -part.quantity,
      reason: "Used on Work Order",
      note: `Work order ${created.workOrderId}`,
      createdByUserId: userId,
    });
    if ("error" in adjustment) warning = `The job was saved, but stock for "${part.name}" wasn't updated: ${adjustment.error}`;
  }

  if (paid && created.invoiceId && formData.get("emailReceipt") === "on" && customerEmail) {
    const sent = await sendInvoice(created.invoiceId);
    if (sent?.error) warning = `The job was saved, but the receipt email wasn't sent: ${sent.error}`;
  }

  revalidatePath("/work-orders");
  revalidatePath("/customers");
  revalidatePath("/equipment");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true as const, redirectTo: created.invoiceId ? `/invoices/${created.invoiceId}` : `/work-orders/${created.workOrderId}`, warning };
}
