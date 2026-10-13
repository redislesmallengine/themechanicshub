// Building the invoice lines for a work order -- shared by Generate Invoice, Complete & Collect and Quick Job.
// Plain functions (not server actions) so any of those can call them, including inside a transaction.

import { computeTotals } from "@/lib/invoices";
import { flatPriceTotals } from "@/lib/pricing";

export type WorkOrderInvoiceLine = { type: string; description: string; quantity: string; unitPrice: string; unitCost: string | null; taxable: boolean; lineTotal: string; sortOrder: number };

/** The fee choices on the Generate Invoice / Complete & Collect forms. */
export function readFeeOptions(formData: FormData): { includeDiagnosticFee: boolean; deliveryFee: number | null } | { error: string } {
  const includeDiagnosticFee = formData.get("includeDiagnosticFee") === "on";
  if (formData.get("includeDeliveryFee") !== "on") return { includeDiagnosticFee, deliveryFee: null };
  // Staff-entered, not always the shop's configured default -- distance
  // varies job to job (a 2km drop vs. a 20km one), so the amount is
  // editable on the form, pre-filled from shopProfile.deliveryFee but
  // overridable there, not locked to it.
  const raw = String(formData.get("deliveryFeeAmount") ?? "").trim();
  const fee = Number(raw);
  if (!raw || !Number.isFinite(fee) || fee < 0) return { error: "Enter a delivery fee amount." };
  return { includeDiagnosticFee, deliveryFee: fee };
}

/** Labour, parts and the optional fees for one work order -- shared by Generate Invoice and Complete & Collect. */
export function buildWorkOrderInvoiceLines(
  workOrder: { labourHours: { toString(): string } | null; parts: { name: string; quantity: number; unitSellPrice: { toString(): string } | null; unitCostPrice: { toString(): string } | null }[] },
  shopProfile: { labourRate: { toString(): string } | null; diagnosticFee: { toString(): string } | null } | null,
  fees: { includeDiagnosticFee: boolean; deliveryFee: number | null }
): WorkOrderInvoiceLine[] {
  const lines: WorkOrderInvoiceLine[] = [];
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

  if (fees.includeDiagnosticFee && shopProfile?.diagnosticFee) {
    const fee = Number(shopProfile.diagnosticFee);
    lines.push({ type: "fee", description: "Diagnostic Fee", quantity: "1.00", unitPrice: fee.toFixed(2), unitCost: null, taxable: true, lineTotal: fee.toFixed(2), sortOrder: sortOrder++ });
  }

  if (fees.deliveryFee !== null) {
    lines.push({ type: "fee", description: "Pickup/Delivery Fee", quantity: "1.00", unitPrice: fees.deliveryFee.toFixed(2), unitCost: null, taxable: true, lineTotal: fees.deliveryFee.toFixed(2), sortOrder: sortOrder++ });
  }

  return lines;
}

// ---------------------------------------------------------------------------------------------
// Billing choice: "by hours and parts" (labour x rate + parts) or "one flat price" (what the owner
// charged, typed in, with tax included or added on top). Used by Quick Job and Complete & Collect.
// ---------------------------------------------------------------------------------------------

export type Billing = { mode: "hours" } | { mode: "flat"; amount: number; taxIncluded: boolean; description: string };

/** Reads the billing choice from a form. `fallbackDescription` names the flat line when none was typed. */
export function readBilling(formData: FormData, fallbackDescription: string): Billing | { error: string } {
  if (formData.get("billingMode") !== "flat") return { mode: "hours" };
  const raw = String(formData.get("flatAmount") ?? "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount charged, for example 207.00." };
  const description = String(formData.get("flatDescription") ?? "").trim() || fallbackDescription || "Repair service";
  return { mode: "flat", amount, taxIncluded: formData.get("flatTax") !== "extra", description: description.slice(0, 200) };
}

type Totals = { subtotal: string; taxAmount: string; total: string };

function addTotals(a: Totals, b: Totals): Totals {
  const sum = (x: string, y: string) => (Number(x) + Number(y)).toFixed(2);
  return { subtotal: sum(a.subtotal, b.subtotal), taxAmount: sum(a.taxAmount, b.taxAmount), total: sum(a.total, b.total) };
}

/**
 * The invoice lines and totals for a job, whichever way it is billed. A flat price is one line (any fees
 * ticked are added after it); a tax-included flat price totals exactly the amount typed. Parts used on the
 * job still come out of stock, but with a flat price they are part of that one price, not separate lines.
 */
export function buildInvoiceFromBilling(params: {
  billing: Billing;
  labourHours: { toString(): string } | null;
  parts: { name: string; quantity: number; unitSellPrice: { toString(): string } | null; unitCostPrice: { toString(): string } | null }[];
  shopProfile: { labourRate: { toString(): string } | null; diagnosticFee: { toString(): string } | null; taxRate: { toString(): string } | null } | null;
  fees: { includeDiagnosticFee: boolean; deliveryFee: number | null };
}): { lines: WorkOrderInvoiceLine[]; totals: Totals } {
  const { billing, labourHours, parts, shopProfile, fees } = params;
  const taxRate = Number(shopProfile?.taxRate ?? 0);

  if (billing.mode === "hours") {
    const lines = buildWorkOrderInvoiceLines({ labourHours, parts }, shopProfile, fees);
    return { lines, totals: computeTotals(lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })), taxRate) };
  }

  const flat = flatPriceTotals(billing.amount, billing.taxIncluded, taxRate);
  const flatLine: WorkOrderInvoiceLine = {
    type: "labor",
    description: billing.description,
    quantity: "1.00",
    unitPrice: flat.unitPrice.toFixed(2),
    unitCost: null,
    taxable: true,
    lineTotal: flat.unitPrice.toFixed(2),
    sortOrder: 0,
  };
  // Fees only: no labour hours, no parts.
  const feeLines = buildWorkOrderInvoiceLines({ labourHours: null, parts: [] }, shopProfile, fees).map((l, i) => ({ ...l, sortOrder: i + 1 }));
  const feeTotals = computeTotals(feeLines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })), taxRate);
  return { lines: [flatLine, ...feeLines], totals: addTotals(flat, feeTotals) };
}
