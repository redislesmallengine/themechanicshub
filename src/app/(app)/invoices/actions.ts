"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { claimInvoiceNumber, generateViewToken, computeTotals, isEditable, PAYMENT_METHODS, type LineItemInput } from "@/lib/invoices";
import { renderInvoicePdfFromRecord } from "@/lib/invoice-pdf";

async function requireCanManageInvoices(action: "create" | "update" | "void" = "update") {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) throw new Error("Not signed in to a shop.");

  const allowed = await auth.api.hasPermission({
    headers: reqHeaders,
    body: { permissions: { invoice: [action] } },
  });
  if (!allowed.success) throw new Error("You don't have permission to do that.");

  return { organizationId: session.session.activeOrganizationId };
}

async function loadOwnInvoice(invoiceId: string, organizationId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true } });
  if (!invoice || invoice.organizationId !== organizationId) return null;
  return invoice;
}

/** Recomputes and persists subtotal/taxAmount/total from the invoice's current line items — called after any line item change. */
async function recalcTotals(invoiceId: string, organizationId: string) {
  const [lineItems, shopProfile] = await Promise.all([
    prisma.invoiceLineItem.findMany({ where: { invoiceId } }),
    prisma.shopProfile.findUnique({ where: { organizationId } }),
  ]);
  const inputs: LineItemInput[] = lineItems.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable }));
  const totals = computeTotals(inputs, Number(shopProfile?.taxRate ?? 0));
  await prisma.invoice.update({ where: { id: invoiceId }, data: totals });
}

export async function generateInvoiceFromWorkOrder(workOrderId: string, formData: FormData) {
  const { organizationId } = await requireCanManageInvoices("create");

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { parts: true, invoice: true },
  });
  if (!workOrder || workOrder.organizationId !== organizationId) return { error: "That work order doesn't exist." };
  if (workOrder.status !== "readyForPickup" && workOrder.status !== "closed") {
    return { error: "This work order isn't ready to invoice yet — mark it Ready for Pickup first." };
  }
  if (workOrder.invoice) return { error: "This work order already has an invoice." };

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

export async function removeLineItem(lineItemId: string) {
  const { organizationId } = await requireCanManageInvoices("update");

  const line = await prisma.invoiceLineItem.findUnique({ where: { id: lineItemId }, include: { invoice: true } });
  if (!line || line.invoice.organizationId !== organizationId) return { error: "That line doesn't exist." };
  if (!isEditable(line.invoice.status)) return { error: "This invoice can't be edited anymore." };

  await prisma.invoiceLineItem.delete({ where: { id: lineItemId } });
  await recalcTotals(line.invoiceId, organizationId);

  revalidatePath(`/invoices/${line.invoiceId}`);
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

export async function sendInvoice(invoiceId: string) {
  const { organizationId } = await requireCanManageInvoices("update");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } }, customer: true, organization: { include: { shopProfile: true } } },
  });
  if (!invoice || invoice.organizationId !== organizationId) return { error: "That invoice doesn't exist." };
  if (invoice.status !== "draft") return { error: "This invoice was already sent." };
  if (invoice.lineItems.length === 0) return { error: "Add at least one line item before sending." };
  if (!invoice.customer.email) return { error: "This customer has no email on file — add one before sending an invoice." };

  const pdfBuffer = await renderInvoicePdfFromRecord(invoice);

  const url = `${process.env.BETTER_AUTH_URL}/invoice/${invoice.viewToken}`;
  await sendMail({
    to: invoice.customer.email,
    subject: `Invoice ${invoice.invoiceNumber} from ${invoice.organization.name}`,
    html: `<p>Your invoice is ready — total due: <b>$${invoice.total.toString()}</b>.</p>
           <p><a href="${url}">View your invoice</a></p>
           <p>A PDF copy is attached.</p>`,
    organizationId,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "sent", sentAt: new Date() } });

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
  revalidatePath(`/work-orders/${invoice.workOrderId}`);
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
  revalidatePath(`/work-orders/${invoice.workOrderId}`);
  return { success: true };
}
