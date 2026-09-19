"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { loadEmailTemplate, renderTemplate } from "@/lib/email-templates";
import { claimInvoiceNumber, generateViewToken, computeTotals, classifyInvoiceType, isEditable, PAYMENT_METHODS, type LineItemInput } from "@/lib/invoices";
import { applyStockAdjustment } from "@/lib/inventory";
import { renderInvoicePdfFromRecord } from "@/lib/invoice-pdf";

async function requireCanManageInvoices(action: "create" | "update" | "void" | "delete" = "update") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { invoice: [action] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to do that.");

  return { organizationId: session.session.activeOrganizationId, userId: session.user.id };
}

async function loadOwnInvoice(invoiceId: string, organizationId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true, combinedWorkOrders: true } });
  if (!invoice || invoice.organizationId !== organizationId) return null;
  return invoice;
}

/** Recomputes and persists subtotal/taxAmount/total (and invoiceType — adding/removing a line can flip Repair Service into Combined) from the invoice's current line items — called after any line item change. */
async function recalcTotals(invoiceId: string, organizationId: string) {
  const [invoice, lineItems, shopProfile, combinedWorkOrderCount] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId }, select: { equipmentId: true, adHocEquipmentLabel: true, workOrderId: true } }),
    prisma.invoiceLineItem.findMany({ where: { invoiceId } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
    prisma.invoiceWorkOrder.count({ where: { invoiceId } }),
  ]);
  // Non-header lines only -- a header's own quantity/price are always 0, but
  // filtering keeps this correct even if that ever changes.
  const inputs: LineItemInput[] = lineItems.filter((l) => l.type !== "header").map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable }));
  const totals = computeTotals(inputs, Number(shopProfile?.taxRate ?? 0));
  const invoiceType = classifyInvoiceType({
    hasEquipment: !!invoice?.equipmentId || !!invoice?.adHocEquipmentLabel || combinedWorkOrderCount > 0,
    hasWorkOrder: !!invoice?.workOrderId || combinedWorkOrderCount > 0,
    lineItems: lineItems.map((l) => ({ type: l.type, partId: l.partId })),
  });
  await prisma.invoice.update({ where: { id: invoiceId }, data: { ...totals, invoiceType } });
}

export async function generateInvoiceFromWorkOrder(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("create");

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { parts: true, invoice: true, combinedInto: true },
  });
  if (!workOrder || workOrder.organizationId !== organizationId) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "readyForPickup" && workOrder.status !== "closed") {
    return { error: "This work order isn't ready to invoice yet — mark it Ready for Pickup first." };
  }
  if (workOrder.invoice || workOrder.combinedInto) return { error: "This work order already has an invoice." };

  const shopProfile = await prisma.shopProfile.findUnique({ where: { organizationId } });
  const includeDiagnosticFee = formData.get("includeDiagnosticFee") === "on";

  const lines: { type: string; description: string; quantity: string; unitPrice: string; unitCost: string | null; taxable: boolean; lineTotal: string; sortOrder: number }[] = [];
  let sortOrder = 0;

  if (workOrder.labourHours && shopProfile?.labourRate) {
    const hours = Number(workOrder.labourHours);
    const rate = Number(shopProfile.labourRate);
    lines.push({
      type: "labor",
      description: `Labor (${hours} hrs @ $${rate.toFixed(2)}/hr)`,
      quantity: hours.toFixed(2),
      unitPrice: rate.toFixed(2),
      unitCost: null,
      taxable: true,
      lineTotal: (hours * rate).toFixed(2),
      sortOrder: sortOrder++,
    });
  }

  for (const part of workOrder.parts) {
    const unitPrice = Number(part.unitSellPrice ?? 0);
    lines.push({
      type: "part",
      description: part.name,
      quantity: part.quantity.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      unitCost: part.unitCostPrice?.toString() ?? null,
      taxable: true,
      lineTotal: (part.quantity * unitPrice).toFixed(2),
      sortOrder: sortOrder++,
    });
  }

  if (includeDiagnosticFee && shopProfile?.diagnosticFee) {
    const fee = Number(shopProfile.diagnosticFee);
    lines.push({
      type: "fee",
      description: "Diagnostic Fee",
      quantity: "1.00",
      unitPrice: fee.toFixed(2),
      unitCost: null,
      taxable: true,
      lineTotal: fee.toFixed(2),
      sortOrder: sortOrder++,
    });
  }

  const totals = computeTotals(
    lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })),
    Number(shopProfile?.taxRate ?? 0)
  );

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await claimInvoiceNumber(tx, organizationId);
    return tx.invoice.create({
      data: {
        organizationId,
        workOrderId,
        customerId: workOrder.customerId,
        equipmentId: workOrder.equipmentId,
        invoiceType: classifyInvoiceType({ hasEquipment: true, hasWorkOrder: true, lineItems: lines.map((l) => ({ type: l.type })) }),
        invoiceNumber,
        viewToken: generateViewToken(),
        ...totals,
        lineItems: { create: lines },
      },
    });
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

/** Work orders for this customer that are ready to fold into a combined invoice — same eligibility rule as generateInvoiceFromWorkOrder, minus the "already has an invoice" case (checked here via both the direct link and the combined-invoice join table). Used by the New Invoice page to build its checklist. */
export async function listInvoiceableWorkOrders(customerId: string) {
  const { organizationId } = await requireCanManageInvoices("create");
  if (!customerId) return { success: true as const, workOrders: [] };

  const workOrders = await prisma.workOrder.findMany({
    where: { organizationId, customerId, status: { in: ["readyForPickup", "closed"] }, invoice: null, combinedInto: null },
    include: { equipment: { include: { equipmentType: true } } },
    orderBy: { readyForPickupAt: "asc" },
  });

  return {
    success: true as const,
    workOrders: workOrders.map((wo) => ({
      id: wo.id,
      label: [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment",
      complaint: wo.complaint,
    })),
  };
}

/**
 * Folds 2+ ready-to-invoice work orders for the SAME customer into one
 * invoice, instead of one invoice per machine — see InvoiceWorkOrder's
 * schema comment for why this is a separate join table rather than widening
 * Invoice.workOrderId. Each work order's labor/parts/diagnostic fee are
 * pulled in exactly like generateInvoiceFromWorkOrder, just looped, with a
 * non-priced "header" line item (its equipment's name) inserted before each
 * one's lines so the invoice reads as clearly separated per-machine
 * sections rather than one undifferentiated list.
 */
export async function generateCombinedInvoice(customerId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("create");

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };

  const workOrderIds = formData.getAll("workOrderIds").map(String).filter(Boolean);
  if (workOrderIds.length < 2) return { error: "Pick at least 2 work orders to combine into one invoice." };

  const workOrders = await prisma.workOrder.findMany({
    where: { id: { in: workOrderIds } },
    include: { parts: true, equipment: { include: { equipmentType: true } }, invoice: true, combinedInto: true },
  });
  if (workOrders.length !== workOrderIds.length) return { error: "One of those work orders no longer exists." };
  for (const wo of workOrders) {
    if (wo.organizationId !== organizationId || wo.customerId !== customerId) return { error: "Every work order must belong to this customer." };
    if (wo.status !== "readyForPickup" && wo.status !== "closed") return { error: "Every work order must be Ready for Pickup or Closed first." };
    if (wo.invoice || wo.combinedInto) return { error: "One of those work orders already has an invoice." };
  }

  const shopProfile = await prisma.shopProfile.findUnique({ where: { organizationId } });
  const includeDiagnosticFee = formData.get("includeDiagnosticFee") === "on";

  const lines: { type: string; description: string; quantity: string; unitPrice: string; unitCost: string | null; taxable: boolean; lineTotal: string; sortOrder: number }[] = [];
  let sortOrder = 0;

  for (const wo of workOrders) {
    const equipmentLabel = [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment";
    lines.push({ type: "header", description: equipmentLabel, quantity: "0.00", unitPrice: "0.00", unitCost: null, taxable: false, lineTotal: "0.00", sortOrder: sortOrder++ });

    if (wo.labourHours && shopProfile?.labourRate) {
      const hours = Number(wo.labourHours);
      const rate = Number(shopProfile.labourRate);
      lines.push({
        type: "labor",
        description: `Labor (${hours} hrs @ $${rate.toFixed(2)}/hr)`,
        quantity: hours.toFixed(2),
        unitPrice: rate.toFixed(2),
        unitCost: null,
        taxable: true,
        lineTotal: (hours * rate).toFixed(2),
        sortOrder: sortOrder++,
      });
    }

    for (const part of wo.parts) {
      const unitPrice = Number(part.unitSellPrice ?? 0);
      lines.push({
        type: "part",
        description: part.name,
        quantity: part.quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        unitCost: part.unitCostPrice?.toString() ?? null,
        taxable: true,
        lineTotal: (part.quantity * unitPrice).toFixed(2),
        sortOrder: sortOrder++,
      });
    }

    if (includeDiagnosticFee && shopProfile?.diagnosticFee) {
      const fee = Number(shopProfile.diagnosticFee);
      lines.push({
        type: "fee",
        description: `Diagnostic Fee — ${equipmentLabel}`,
        quantity: "1.00",
        unitPrice: fee.toFixed(2),
        unitCost: null,
        taxable: true,
        lineTotal: fee.toFixed(2),
        sortOrder: sortOrder++,
      });
    }
  }

  const totals = computeTotals(
    lines.filter((l) => l.type !== "header").map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })),
    Number(shopProfile?.taxRate ?? 0)
  );

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await claimInvoiceNumber(tx, organizationId);
    const created = await tx.invoice.create({
      data: {
        organizationId,
        customerId,
        invoiceType: classifyInvoiceType({ hasEquipment: true, hasWorkOrder: true, lineItems: lines.map((l) => ({ type: l.type })) }),
        invoiceNumber,
        viewToken: generateViewToken(),
        ...totals,
        lineItems: { create: lines },
      },
    });
    await tx.invoiceWorkOrder.createMany({ data: workOrders.map((wo) => ({ invoiceId: created.id, workOrderId: wo.id })) });
    return created;
  });

  for (const wo of workOrders) revalidatePath(`/work-orders/${wo.id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Standalone invoice — no Work Order behind it. Covers a counter parts sale
 * (nothing about equipment), a repair billed on the spot for a customer's
 * registered equipment, and a repair with no record at all behind it — a
 * walk-in with nothing on file, described in plain text via
 * adHocEquipmentLabel instead of a real Equipment link. Customer and
 * equipment are independently optional — see "No Customer Info" handling on
 * the invoice pages/PDF. Line items are added afterward via the existing
 * addCustomLineItem, same as any invoice.
 */
export async function createStandaloneInvoice(formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("create");

  const customerId = String(formData.get("customerId") ?? "").trim() || null;
  const equipmentId = String(formData.get("equipmentId") ?? "").trim() || null;
  const adHocEquipmentLabel = String(formData.get("adHocEquipmentLabel") ?? "").trim() || null;

  if (equipmentId && adHocEquipmentLabel) {
    return { error: "Pick registered equipment or describe the machine — not both." };
  }

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };
  }

  if (equipmentId) {
    if (!customerId) return { error: "Pick a customer first to attach their equipment." };
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment || equipment.organizationId !== organizationId || equipment.customerId !== customerId) {
      return { error: "That equipment doesn't belong to this customer." };
    }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await claimInvoiceNumber(tx, organizationId);
    return tx.invoice.create({
      data: {
        organizationId,
        customerId,
        equipmentId,
        adHocEquipmentLabel,
        invoiceType: classifyInvoiceType({ hasEquipment: !!equipmentId || !!adHocEquipmentLabel, hasWorkOrder: false, lineItems: [] }),
        invoiceNumber,
        viewToken: generateViewToken(),
      },
    });
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function addCustomLineItem(invoiceId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (!isEditable(invoice.status)) return { error: "This invoice can't be edited anymore." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Description is required." };

  const quantity = Number(formData.get("quantity") ?? "1");
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity needs to be a positive number." };

  const unitPrice = Number(formData.get("unitPrice") ?? "");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Price needs to be a positive number." };

  const taxable = formData.get("taxable") === "on";

  await prisma.invoiceLineItem.create({
    data: {
      invoiceId,
      type: "custom",
      description,
      quantity: quantity.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      taxable,
      lineTotal: (quantity * unitPrice).toFixed(2),
      sortOrder: invoice.lineItems.length,
    },
  });
  await recalcTotals(invoiceId, organizationId);

  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

/**
 * The "From Inventory" counterpart to addCustomLineItem — rings up a real
 * Part directly on the invoice: decrements actual stock through the same
 * applyStockAdjustment() Work Orders already use (same negative-stock
 * block, same low-stock email, same Stock History audit trail), and
 * snapshots its name/prices onto the line the same way WorkOrderPart does.
 * partId being set here (vs. left null on a line copied in from a Work
 * Order) is what tells removeLineItem and classifyInvoiceType this part's
 * stock was moved right here, on this invoice.
 */
export async function addInventoryLineItem(invoiceId: string, formData: FormData) {
  const { organizationId, userId } = await requireCanManageInvoices("update");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (!isEditable(invoice.status)) return { error: "This invoice can't be edited anymore." };

  const partId = String(formData.get("partId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = Number(quantityRaw);
  if (!partId) return { error: "Pick a part." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Quantity needs to be a whole number greater than zero." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || part.organizationId !== organizationId) return { error: "That part doesn't exist." };

  const taxable = formData.get("taxable") === "on";
  const unitPrice = Number(part.sellPrice ?? 0);

  const adjustment = await applyStockAdjustment({
    organizationId,
    partId,
    delta: -quantity,
    reason: "Sold on Invoice",
    note: `Invoice ${invoiceId}`,
    createdByUserId: userId,
  });
  if ("error" in adjustment) return { error: adjustment.error };

  await prisma.invoiceLineItem.create({
    data: {
      invoiceId,
      type: "part",
      partId,
      description: part.name,
      quantity: quantity.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      unitCost: part.costPrice?.toString() ?? null,
      taxable,
      lineTotal: (quantity * unitPrice).toFixed(2),
      sortOrder: invoice.lineItems.length,
    },
  });
  await recalcTotals(invoiceId, organizationId);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/inventory");
  return { success: true };
}

export async function removeLineItem(lineItemId: string) {
  const { organizationId, userId } = await requireCanManageInvoices("update");

  const line = await prisma.invoiceLineItem.findUnique({ where: { id: lineItemId }, include: { invoice: true } });
  if (!line || line.invoice.organizationId !== organizationId) return { error: "That line doesn't exist." };
  if (!isEditable(line.invoice.status)) return { error: "This invoice can't be edited anymore." };

  // Only a line rung up directly on this invoice ever moved stock (partId
  // set — see addInventoryLineItem); a line copied in from a Work Order was
  // already decremented there, so removing it here must NOT touch stock.
  if (line.partId) {
    const restore = await applyStockAdjustment({
      organizationId,
      partId: line.partId,
      delta: Number(line.quantity),
      reason: "Correction",
      note: `Removed from invoice ${line.invoiceId}`,
      createdByUserId: userId,
    });
    if ("error" in restore) return { error: restore.error };
  }

  await prisma.invoiceLineItem.delete({ where: { id: lineItemId } });
  await recalcTotals(line.invoiceId, organizationId);

  revalidatePath(`/invoices/${line.invoiceId}`);
  revalidatePath("/inventory");
  return { success: true };
}

export async function updateInvoiceDetails(invoiceId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };

  const notes = String(formData.get("notes") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : undefined;
  if (dueDateRaw && Number.isNaN(dueDate?.getTime())) return { error: "That due date isn't valid." };

  await prisma.invoice.update({ where: { id: invoiceId }, data: { notes: notes || null, ...(dueDate ? { dueDate } : {}) } });

  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

/**
 * Changes who/what a STANDALONE invoice is for — the one thing
 * createStandaloneInvoice locked in at creation. Only applies when there's
 * no Work Order behind the invoice; a Work Order-sourced invoice's
 * customer/equipment come from the work order itself, so this refuses
 * rather than let the two silently drift apart. Same validation rules as
 * createStandaloneInvoice (customer optional, equipment optional and
 * mutually exclusive with a plain-text description).
 */
export async function updateInvoiceParty(invoiceId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (!isEditable(invoice.status)) return { error: "This invoice can't be edited anymore." };
  if (invoice.workOrderId) return { error: "This invoice's customer and equipment come from its work order — edit the work order instead." };
  if (invoice.combinedWorkOrders.length > 0) return { error: "This invoice's customer and equipment come from its combined work orders — edit those instead." };

  const customerId = String(formData.get("customerId") ?? "").trim() || null;
  const equipmentId = String(formData.get("equipmentId") ?? "").trim() || null;
  const adHocEquipmentLabel = String(formData.get("adHocEquipmentLabel") ?? "").trim() || null;

  if (equipmentId && adHocEquipmentLabel) {
    return { error: "Pick registered equipment or describe the machine — not both." };
  }

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.organizationId !== organizationId) return { error: "That customer doesn't exist." };
  }

  if (equipmentId) {
    if (!customerId) return { error: "Pick a customer first to attach their equipment." };
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment || equipment.organizationId !== organizationId || equipment.customerId !== customerId) {
      return { error: "That equipment doesn't belong to this customer." };
    }
  }

  await prisma.invoice.update({ where: { id: invoiceId }, data: { customerId, equipmentId, adHocEquipmentLabel } });
  await recalcTotals(invoiceId, organizationId); // equipment presence can flip Parts Only <-> Repair Service/Combined

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: true };
}

/** Shared by sendInvoice (real send) and previewInvoiceEmail (preview only) so the two can never drift apart. */
async function buildInvoiceEmail(organizationId: string, params: { customerName: string; invoiceNumber: string; shopName: string; total: string; url: string }) {
  const template = await loadEmailTemplate(organizationId, "invoice");
  const data = {
    customer_name: params.customerName,
    shop_name: params.shopName,
    invoice_number: params.invoiceNumber,
    total: `$${params.total}`,
    invoice_link: params.url,
  };
  return { subject: renderTemplate(template.subject, data), html: renderTemplate(template.html, data) };
}

/** Returns the exact email sendInvoice would send, without sending it. Unlike the estimate's approval link, an invoice's viewToken already exists (set at creation), so this shows the real, final link — not a placeholder. */
export async function previewInvoiceEmail(invoiceId: string) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, organization: { include: { shopProfile: true } } },
  });
  if (!invoice || invoice.organizationId !== organizationId) return { error: "That invoice doesn't exist." };

  const url = `${process.env.BETTER_AUTH_URL}/invoice/${invoice.viewToken}`;
  const { subject, html } = await buildInvoiceEmail(organizationId, {
    customerName: invoice.customer?.name ?? "there",
    invoiceNumber: invoice.invoiceNumber,
    shopName: invoice.organization.name,
    total: invoice.total.toString(),
    url,
  });

  return { success: true, subject, html, to: invoice.customer?.email ?? null, replyTo: invoice.organization.shopProfile?.invoiceReplyToEmail ?? null };
}

/**
 * Sendable at any status except Void — including Paid, so a shop can hand a
 * customer a fresh copy after the fact (lost the email, wants it for their
 * own records, etc.). Only flips status/sentAt to "sent" the first time
 * (currently Draft); resending an already-Sent/Viewed/Paid invoice must
 * never downgrade its status back and lose that it was actually paid.
 */
export async function sendInvoice(invoiceId: string) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      customer: true,
      equipment: { include: { equipmentType: true } },
      organization: { include: { shopProfile: true } },
    },
  });
  if (!invoice || invoice.organizationId !== organizationId) return { error: "That invoice doesn't exist." };
  if (invoice.status === "void") return { error: "This invoice has been voided — nothing to send." };
  if (invoice.lineItems.length === 0) return { error: "Add at least one line item before sending." };
  if (!invoice.customer) return { error: "This invoice has no customer attached — nothing to send it to. Download the PDF instead." };
  if (!invoice.customer.email) return { error: "This customer has no email on file — add one before sending an invoice." };

  const pdfBuffer = await renderInvoicePdfFromRecord(invoice);

  const url = `${process.env.BETTER_AUTH_URL}/invoice/${invoice.viewToken}`;
  const { subject, html } = await buildInvoiceEmail(organizationId, {
    customerName: invoice.customer.name,
    invoiceNumber: invoice.invoiceNumber,
    shopName: invoice.organization.name,
    total: invoice.total.toString(),
    url,
  });
  await sendMail({
    to: invoice.customer.email,
    subject,
    html,
    organizationId,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
    relatedType: "invoice",
    relatedId: invoiceId,
    replyTo: invoice.organization.shopProfile?.invoiceReplyToEmail ?? undefined,
  });

  if (invoice.status === "draft") {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "sent", sentAt: new Date() } });
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: true };
}

export async function markInvoicePaid(invoiceId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (invoice.status === "paid" || invoice.status === "void") return { error: "This invoice is already closed out." };

  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) return { error: "Choose a payment method." };

  const paymentReference = String(formData.get("paymentReference") ?? "").trim();

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "paid", paidAt: new Date(), paymentMethod, paymentReference: paymentReference || null },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  if (invoice.workOrderId) revalidatePath(`/work-orders/${invoice.workOrderId}`);
  for (const cwo of invoice.combinedWorkOrders) revalidatePath(`/work-orders/${cwo.workOrderId}`);
  return { success: true };
}

export async function voidInvoice(invoiceId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("void");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (invoice.status === "paid") return { error: "A paid invoice can't be voided — this needs a manual adjustment instead." };
  if (invoice.status === "void") return { error: "This invoice is already void." };

  const voidReason = String(formData.get("voidReason") ?? "").trim();
  if (!voidReason) return { error: "Give a reason for voiding this invoice." };

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "void", voidedAt: new Date(), voidReason } });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  if (invoice.workOrderId) revalidatePath(`/work-orders/${invoice.workOrderId}`);
  for (const cwo of invoice.combinedWorkOrders) revalidatePath(`/work-orders/${cwo.workOrderId}`);
  return { success: true };
}

/**
 * Permanently removes an invoice — only while it's still Draft (never sent,
 * so no customer could have ever seen it and its number was never
 * meaningfully "issued"). Anything already sent/viewed/paid uses Void
 * instead, which keeps the record and its invoice number intact. Restores
 * stock for every inventory-linked line first (mirrors removeLineItem),
 * since InvoiceLineItem cascade-deletes with the invoice and would
 * otherwise silently skip that.
 */
export async function deleteInvoice(invoiceId: string) {
  const { organizationId, userId } = await requireCanManageInvoices("delete");
  const invoice = await loadOwnInvoice(invoiceId, organizationId);
  if (!invoice) return { error: "That invoice doesn't exist." };
  if (invoice.status !== "draft") return { error: "Only a draft invoice can be deleted — void this one instead." };

  for (const line of invoice.lineItems) {
    if (!line.partId) continue;
    const restore = await applyStockAdjustment({
      organizationId,
      partId: line.partId,
      delta: Number(line.quantity),
      reason: "Correction",
      note: `Invoice ${invoiceId} deleted`,
      createdByUserId: userId,
    });
    if ("error" in restore) return { error: restore.error };
  }

  const workOrderId = invoice.workOrderId;
  const combinedWorkOrderIds = invoice.combinedWorkOrders.map((cwo) => cwo.workOrderId);
  await prisma.invoice.delete({ where: { id: invoiceId } }); // cascades InvoiceLineItem and InvoiceWorkOrder rows

  revalidatePath("/invoices");
  if (workOrderId) revalidatePath(`/work-orders/${workOrderId}`);
  for (const id of combinedWorkOrderIds) revalidatePath(`/work-orders/${id}`);
  return { success: true };
}
