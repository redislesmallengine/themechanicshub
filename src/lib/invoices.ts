import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

export const INVOICE_STATUSES = ["draft", "sent", "viewed", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  void: "Void",
};

export const STATUS_BADGE: Record<InvoiceStatus, "success" | "warning" | "error" | "info"> = {
  draft: "info",
  sent: "warning",
  viewed: "warning",
  paid: "success",
  void: "error",
};

export const PAYMENT_METHODS = ["Cash", "E-transfer", "Card", "Cheque", "Other"] as const;

export const INVOICE_TYPES = ["partsOnly", "repairService", "combined"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  partsOnly: "Parts Only",
  repairService: "Equipment Repair Service",
  combined: "Combined",
};

export const INVOICE_TYPE_BADGE: Record<InvoiceType, "success" | "warning" | "error" | "info"> = {
  partsOnly: "info",
  repairService: "success",
  combined: "warning",
};

/**
 * Recomputed after every line-item change (recalcTotals in
 * invoices/actions.ts) — never staff-chosen. No equipment attached is
 * always Parts Only. Equipment attached is Repair Service, unless the
 * invoice came from a Work Order (whose generated lines are always typed
 * "labor"/"part"/"fee") and has since had an ad-hoc line added on top
 * (always typed "custom" — see addCustomLineItem): that combination is what
 * "Combined" means — a repair invoice with something extra tacked on.
 */
export function classifyInvoiceType(params: { hasEquipment: boolean; hasWorkOrder: boolean; lineItemTypes: string[] }): InvoiceType {
  if (!params.hasEquipment) return "partsOnly";
  if (params.hasWorkOrder && params.lineItemTypes.includes("custom")) return "combined";
  return "repairService";
}

/** Line items are still editable while in any of these — locked once Paid or Void. */
export function isEditable(status: string): boolean {
  return status === "draft" || status === "sent" || status === "viewed";
}

/** An unpaid invoice past its due date — computed on read, never stored (no background job in Phase 6, that's Phase 7's nightly sweep). */
export function isOverdue(status: string, dueDate: Date, now: number = Date.now()): boolean {
  return (status === "sent" || status === "viewed") && dueDate.getTime() < now;
}

/** Atomically claims the next sequential invoice number for a shop — safe under concurrent requests since the increment happens inside the transaction. */
export async function claimInvoiceNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
  const updated = await tx.shopProfile.update({
    where: { organizationId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true },
  });
  return `INV-${updated.nextInvoiceNumber - 1}`;
}

export function generateViewToken(): string {
  return randomBytes(24).toString("hex");
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}

/** Every place that changes line items recomputes from scratch off the live set, rather than incrementally patching stored totals — simpler, and impossible to drift out of sync. */
export function computeTotals(lines: LineItemInput[], taxRatePercent: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const taxableSubtotal = lines.filter((l) => l.taxable).reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const taxAmount = taxableSubtotal * (taxRatePercent / 100);
  const total = subtotal + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}
