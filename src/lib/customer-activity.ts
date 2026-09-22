/**
 * Builds a single chronological activity feed for a customer's page by
 * merging Work Order and Invoice milestones -- there's no dedicated audit
 * log table for this; it's derived on read from timestamps the app already
 * stores (WorkOrder.createdAt/closedAt, Invoice.createdAt/sentAt/paidAt/
 * voidedAt), so it reflects real events without a new table to keep in sync.
 */

export type ActivityTone = "success" | "warning" | "error" | "info" | "neutral";

export interface ActivityEntry {
  id: string;
  date: Date;
  label: string;
  detail: string;
  tone: ActivityTone;
}

export function buildCustomerActivity(params: {
  customerCreatedAt: Date;
  workOrders: { id: string; status: string; complaint: string; equipmentLabel: string; createdAt: Date; closedAt: Date | null }[];
  invoices: { id: string; invoiceNumber: string; total: string; createdAt: Date; sentAt: Date | null; paidAt: Date | null; voidedAt: Date | null }[];
}): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const wo of params.workOrders) {
    entries.push({
      id: `wo-created-${wo.id}`,
      date: wo.createdAt,
      label: "Work order opened",
      detail: `${wo.equipmentLabel} — ${wo.complaint}`,
      tone: "info",
    });
    if (wo.closedAt) {
      entries.push({
        id: `wo-closed-${wo.id}`,
        date: wo.closedAt,
        label: wo.status === "declined" ? "Work order declined" : "Work order closed",
        detail: wo.equipmentLabel,
        tone: wo.status === "declined" ? "error" : "success",
      });
    }
  }

  for (const inv of params.invoices) {
    entries.push({
      id: `inv-created-${inv.id}`,
      date: inv.createdAt,
      label: "Invoice created",
      detail: `${inv.invoiceNumber} — $${inv.total}`,
      tone: "neutral",
    });
    if (inv.sentAt) {
      entries.push({ id: `inv-sent-${inv.id}`, date: inv.sentAt, label: "Invoice sent", detail: `${inv.invoiceNumber} — $${inv.total}`, tone: "warning" });
    }
    if (inv.paidAt) {
      entries.push({ id: `inv-paid-${inv.id}`, date: inv.paidAt, label: "Invoice paid", detail: `${inv.invoiceNumber} — $${inv.total}`, tone: "success" });
    }
    if (inv.voidedAt) {
      entries.push({ id: `inv-voided-${inv.id}`, date: inv.voidedAt, label: "Invoice voided", detail: inv.invoiceNumber, tone: "error" });
    }
  }

  entries.push({ id: "customer-created", date: params.customerCreatedAt, label: "Customer added", detail: "", tone: "neutral" });

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}
