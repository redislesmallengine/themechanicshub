// Building the invoice lines for a work order -- shared by Generate Invoice, Complete & Collect and Quick Job.
// Plain functions (not server actions) so any of those can call them, including inside a transaction.

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
