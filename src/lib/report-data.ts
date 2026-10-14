import { prisma } from "@/lib/prisma";
import { localMidnight } from "@/lib/report-range";
import { addDays, classifyLine, toLocalDate, type ReportInvoice, type ReportLine } from "@/lib/report-engine";
import { partLineName } from "@/lib/parts";

const WORK_ORDER = {
  select: {
    source: true,
    dropOffMethod: true,
    assignedTo: { select: { name: true } },
    parts: { select: { name: true, part: { select: { sku: true, category: { select: { name: true } } } } } },
  },
} as const;

const parts = (d: string) => d.split("-").map(Number) as [number, number, number];

/**
 * The shop's invoices for a stretch of days (plus everything still unpaid, for "money still owed"), as the
 * plain rows the report engine works on. Drafts are never loaded: an invoice that has not gone out is not a sale.
 * Cost prices come through only when the viewer is allowed to see margins.
 */
export async function loadReportInvoices(params: { organizationId: string; timeZone: string; from: string; to: string; today: string; canViewMargins: boolean }): Promise<{ invoices: ReportInvoice[]; draftCount: number }> {
  const { organizationId, timeZone, from, to, today, canViewMargins } = params;
  // a little slack either side; the engine does the exact filtering on local days
  const [fy, fm, fd] = parts(addDays(from, -2));
  const [ty, tm, td] = parts(addDays(to, 3));
  const start = localMidnight(fy, fm, fd, timeZone);
  const end = localMidnight(ty, tm, td, timeZone);

  const [rows, firsts, draftCount] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId,
        status: { not: "draft" },
        OR: [{ sentAt: { gte: start, lt: end } }, { paidAt: { gte: start, lt: end } }, { sentAt: null, createdAt: { gte: start, lt: end } }, { status: { in: ["sent", "viewed"] } }],
      },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" }, include: { part: { select: { sku: true, category: { select: { name: true } } } } } },
        customer: { select: { id: true, name: true } },
        equipment: { include: { equipmentType: { select: { name: true } } } },
        warrantyProvider: { select: { name: true } },
        workOrder: WORK_ORDER,
        combinedWorkOrders: { include: { workOrder: WORK_ORDER } },
      },
    }),
    prisma.invoice.groupBy({ by: ["customerId"], where: { organizationId, status: { notIn: ["draft", "void"] }, customerId: { not: null } }, _min: { createdAt: true } }),
    prisma.invoice.count({ where: { organizationId, status: "draft" } }),
  ]);
  const firstInvoice = new Map(firsts.map((f) => [f.customerId, f._min.createdAt?.getTime() ?? 0]));

  const invoices = rows.map((i): ReportInvoice => {
    const issuedAt = i.sentAt ?? i.paidAt ?? i.createdAt;
    const due = toLocalDate(i.dueDate, timeZone);
    const state = i.status === "void" ? "Void" : i.status === "paid" ? "Paid" : due < today ? "Overdue" : "Unpaid";
    const wos = [i.workOrder, ...i.combinedWorkOrders.map((c) => c.workOrder)].filter((w): w is NonNullable<typeof w> => !!w);

    // Part lines copied onto an invoice from a work order do not link back to inventory, so find them by name.
    const known = new Map<string, { sku: string | null; category: string | null }>();
    for (const wo of wos) {
      for (const wp of wo.parts) {
        const info = { sku: wp.part?.sku ?? null, category: wp.part?.category?.name ?? null };
        known.set(wp.name.toLowerCase(), info);
        known.set(partLineName(wp.name, info.sku).toLowerCase(), info);
      }
    }

    const lines: ReportLine[] = [];
    for (const l of i.lineItems) {
      const type = classifyLine(l.type, l.description);
      if (!type) continue;
      const info = l.part ? { sku: l.part.sku, category: l.part.category?.name ?? null } : known.get(l.description.toLowerCase());
      lines.push({
        type, description: l.description, qty: Number(l.quantity), unitPrice: Number(l.unitPrice), unitCost: canViewMargins && l.unitCost !== null ? Number(l.unitCost) : null,
        taxable: l.taxable, total: Number(l.lineTotal), partNumber: type === "Parts" ? info?.sku ?? null : null, partCategory: type === "Parts" ? info?.category ?? "Uncategorized" : null,
      });
    }

    const first = i.customerId ? firstInvoice.get(i.customerId) : undefined;
    return {
      id: i.id, number: i.invoiceNumber, issued: toLocalDate(issuedAt, timeZone), paid: i.status === "paid" ? toLocalDate(i.paidAt ?? issuedAt, timeZone) : null, due, state,
      method: i.status === "paid" ? i.paymentMethod ?? "" : "", reference: i.status === "paid" ? i.paymentReference ?? "" : "",
      customerId: i.customerId, customer: i.customer?.name ?? "Walk-in", customerType: first !== undefined && i.createdAt.getTime() <= first ? "New" : "Repeat",
      machineType: i.equipment ? i.equipment.equipmentType?.name ?? "Other equipment" : i.adHocEquipmentLabel ? "Walk-in machine" : "Counter sale",
      make: i.equipment?.make || (i.equipment ? "Unknown" : "None"), model: i.equipment?.model ?? "",
      tech: wos.find((w) => w.assignedTo)?.assignedTo?.name ?? "Unassigned",
      job: wos.length === 0 ? "Counter sale" : wos.length === 1 && wos[0].source === "quick" ? "Quick job" : "Normal job",
      arrival: wos.length === 0 ? "Not applicable" : wos.some((w) => w.dropOffMethod === "pickupDelivery") ? "Shop pickup/delivery" : "Customer drop-off",
      payer: i.payerType === "warranty" ? "Warranty" : "Customer", provider: i.warrantyProvider?.name ?? "",
      subtotal: Number(i.subtotal), tax: Number(i.taxAmount), total: Number(i.total), taxableBase: lines.filter((l) => l.taxable).reduce((t, l) => t + l.total, 0), lines,
    };
  });
  return { invoices, draftCount };
}
