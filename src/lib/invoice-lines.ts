// Building the invoice lines for a work order -- shared by Generate Invoice, Finish & collect and Quick Job.
// Plain functions (not server actions) so any of those can call them, including inside a transaction.

import { computeTotals } from "./invoices.ts";
import { flatPriceTotals } from "./pricing.ts";
import { partLineName } from "./parts.ts";

export type WorkOrderInvoiceLine = { type: string; description: string; quantity: string; unitPrice: string; unitCost: string | null; taxable: boolean; lineTotal: string; sortOrder: number };

/** The fee choices on the Generate Invoice / Finish & collect forms. */
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

/** Labour, parts and the optional fees for one work order -- shared by Generate Invoice and Finish & collect. */
export function buildWorkOrderInvoiceLines(
  workOrder: { labourHours: { toString(): string } | null; parts: { name: string; quantity: number; unitSellPrice: { toString(): string } | null; unitCostPrice: { toString(): string } | null; part?: { sku: string | null } | null }[] },
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
      description: partLineName(part.name, part.part?.sku),
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
// charged, typed in, with tax included or added on top). Used by Quick Job and Finish & collect.
// ---------------------------------------------------------------------------------------------

export type Billing = { mode: "hours" } | { mode: "flat"; amount: number; taxIncluded: boolean; taxable: boolean; description: string };

/** Reads the billing choice from a form. `fallbackDescription` names the flat line when none was typed. */
export function readBilling(formData: FormData, fallbackDescription: string): Billing | { error: string } {
  if (formData.get("billingMode") !== "flat") return { mode: "hours" };
  const raw = String(formData.get("flatAmount") ?? "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount charged, for example 207.00." };
  const description = String(formData.get("flatDescription") ?? "").trim() || fallbackDescription || "Repair service";
  // A saved service can be marked "no tax"; everything else is taxable.
  return { mode: "flat", amount, taxIncluded: formData.get("flatTax") !== "extra", taxable: formData.get("flatTaxable") !== "off", description: description.slice(0, 200) };
}

/** One-off charges typed on the Finish screen ("shop supplies, $10"): a description and a price before tax. */
export type ExtraCharge = { description: string; amount: number };

/** Reads the extra charges from a form (a JSON list in `extraCharges`), ignoring blank rows. */
export function readExtraCharges(formData: FormData): { items: ExtraCharge[] } | { error: string } {
  const raw = String(formData.get("extraCharges") ?? "").trim();
  if (!raw) return { items: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "The extra charges couldn't be read. Remove them and add them again." };
  }
  if (!Array.isArray(parsed)) return { error: "The extra charges couldn't be read. Remove them and add them again." };
  const items: ExtraCharge[] = [];
  for (const row of parsed.slice(0, 10)) {
    const description = String((row as { description?: unknown })?.description ?? "").trim();
    const amountRaw = String((row as { amount?: unknown })?.amount ?? "").trim();
    if (!description && !amountRaw) continue; // an empty row
    const amount = Number(amountRaw);
    if (!description) return { error: "Give each extra charge a description." };
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) return { error: `Enter an amount for "${description}".` };
    items.push({ description: description.slice(0, 200), amount: Math.round(amount * 100) / 100 });
  }
  return { items };
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
  parts: { name: string; quantity: number; unitSellPrice: { toString(): string } | null; unitCostPrice: { toString(): string } | null; part?: { sku: string | null } | null }[];
  shopProfile: { labourRate: { toString(): string } | null; diagnosticFee: { toString(): string } | null; taxRate: { toString(): string } | null } | null;
  fees: { includeDiagnosticFee: boolean; deliveryFee: number | null };
  /** Extra one-off charges, each taxable, added after everything else. */
  extras?: ExtraCharge[];
}): { lines: WorkOrderInvoiceLine[]; totals: Totals } {
  const base = buildBase(params);
  const extras = params.extras ?? [];
  if (!extras.length) return base;
  const taxRate = Number(params.shopProfile?.taxRate ?? 0);
  const extraLines: WorkOrderInvoiceLine[] = extras.map((e, i) => ({ type: "custom", description: e.description, quantity: "1.00", unitPrice: e.amount.toFixed(2), unitCost: null, taxable: true, lineTotal: e.amount.toFixed(2), sortOrder: base.lines.length + i }));
  const extraTotals = computeTotals(extraLines.map((l) => ({ quantity: 1, unitPrice: Number(l.unitPrice), taxable: true })), taxRate);
  return { lines: [...base.lines, ...extraLines], totals: addTotals(base.totals, extraTotals) };
}

function buildBase(params: {
  billing: Billing;
  labourHours: { toString(): string } | null;
  parts: { name: string; quantity: number; unitSellPrice: { toString(): string } | null; unitCostPrice: { toString(): string } | null; part?: { sku: string | null } | null }[];
  shopProfile: { labourRate: { toString(): string } | null; diagnosticFee: { toString(): string } | null; taxRate: { toString(): string } | null } | null;
  fees: { includeDiagnosticFee: boolean; deliveryFee: number | null };
}): { lines: WorkOrderInvoiceLine[]; totals: Totals } {
  const { billing, labourHours, parts, shopProfile, fees } = params;
  const taxRate = Number(shopProfile?.taxRate ?? 0);

  if (billing.mode === "hours") {
    const lines = buildWorkOrderInvoiceLines({ labourHours, parts }, shopProfile, fees);
    return { lines, totals: computeTotals(lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })), taxRate) };
  }

  const flat = flatPriceTotals(billing.amount, billing.taxIncluded, taxRate, billing.taxable);
  const flatLine: WorkOrderInvoiceLine = {
    type: "labor",
    description: billing.description,
    quantity: "1.00",
    unitPrice: flat.unitPrice.toFixed(2),
    unitCost: null,
    taxable: billing.taxable,
    lineTotal: flat.unitPrice.toFixed(2),
    sortOrder: 0,
  };
  // Fees only: no labour hours, no parts.
  const feeLines = buildWorkOrderInvoiceLines({ labourHours: null, parts: [] }, shopProfile, fees).map((l, i) => ({ ...l, sortOrder: i + 1 }));
  const feeTotals = computeTotals(feeLines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })), taxRate);
  return { lines: [flatLine, ...feeLines], totals: addTotals(flat, feeTotals) };
}

// ---------------------------------------------------------------------------------------------
// The Billing screen: a list of rows (labour, saved services, parts, other charges), each with a
// quantity and a price, and one rule for tax -- the prices typed are before tax, or already include it.
// ---------------------------------------------------------------------------------------------

export type BillingRowKind = "labour" | "service" | "part" | "other";
export type BillingRow = { kind: BillingRowKind; description: string; quantity: number; unitPrice: number; taxable: boolean; workOrderPartId?: string };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Reads the rows from a form (a JSON list in `billingRows`), ignoring blank rows and checking the rest. */
export function readBillingRows(formData: FormData): { rows: BillingRow[] } | { error: string } {
  const raw = String(formData.get("billingRows") ?? "").trim();
  if (!raw) return { rows: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "The price rows couldn't be read. Reload the page and try again." };
  }
  if (!Array.isArray(parsed)) return { error: "The price rows couldn't be read. Reload the page and try again." };
  const rows: BillingRow[] = [];
  for (const r of parsed.slice(0, 60)) {
    const row = r as Partial<Record<keyof BillingRow, unknown>>;
    const kind = row.kind as BillingRowKind;
    if (!["labour", "service", "part", "other"].includes(kind)) continue;
    const description = String(row.description ?? "").trim();
    const quantity = Number(row.quantity);
    const priceRaw = String(row.unitPrice ?? "").trim();
    const unitPrice = Number(priceRaw);
    if (!description && !priceRaw) continue; // an empty row
    if (!description) return { error: "Give every price row a name, or remove the empty one." };
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: `Enter a quantity for "${description}".` };
    if (!priceRaw || !Number.isFinite(unitPrice) || unitPrice < 0) return { error: `Enter a price for "${description}".` };
    rows.push({ kind, description: description.slice(0, 200), quantity, unitPrice, taxable: row.taxable !== false, workOrderPartId: row.workOrderPartId ? String(row.workOrderPartId) : undefined });
  }
  return { rows };
}

/**
 * The invoice lines and totals for the Billing rows. With "before tax" every price is what the customer is charged
 * before tax, and tax is added on top. With "tax included" the prices typed already contain the tax: each taxable
 * row's price is worked back to its pre-tax figure and the grand total is exactly what was typed to the cent
 * (the tax figure absorbs any single-cent rounding, so a $207 job always prints as $207.00).
 */
export function buildInvoiceFromRows(params: { rows: BillingRow[]; taxIncluded: boolean; taxRate: number; unitCosts?: Record<string, string | null> }): { lines: WorkOrderInvoiceLine[]; totals: Totals } {
  const { rows, taxIncluded, taxRate } = params;
  const lines: WorkOrderInvoiceLine[] = rows.map((r, i) => {
    let unitPrice = cents(r.unitPrice);
    if (taxIncluded && r.taxable && taxRate > 0) unitPrice = r.quantity === 1 ? flatPriceTotals(r.unitPrice, true, taxRate, true).unitPrice : cents(r.unitPrice / (1 + taxRate / 100));
    return {
      type: r.kind === "labour" || r.kind === "service" ? "labor" : r.kind === "part" ? "part" : "custom",
      description: r.description,
      quantity: r.quantity.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      unitCost: r.workOrderPartId ? params.unitCosts?.[r.workOrderPartId] ?? null : null,
      taxable: r.taxable,
      lineTotal: cents(r.quantity * unitPrice).toFixed(2),
      sortOrder: i,
    };
  });
  if (!(taxIncluded && taxRate > 0)) {
    return { lines, totals: computeTotals(lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable })), taxRate) };
  }
  // Tax included: the total is the typed figures added up; subtotal is the pre-tax lines; tax is the difference.
  const gross = cents(rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0));
  const subtotal = cents(lines.reduce((sum, l) => sum + Number(l.lineTotal), 0));
  return { lines, totals: { subtotal: subtotal.toFixed(2), taxAmount: cents(gross - subtotal).toFixed(2), total: gross.toFixed(2) } };
}
