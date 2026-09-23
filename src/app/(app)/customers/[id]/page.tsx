import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersIcon } from "@/components/icons";
import { EquipmentMiniList } from "@/components/equipment-mini-list";
import { STATUS_LABELS as WO_STATUS_LABELS, STATUS_BADGE as WO_STATUS_BADGE, type WorkOrderStatus } from "@/lib/work-orders";
import { STATUS_LABELS as INV_STATUS_LABELS, STATUS_BADGE as INV_STATUS_BADGE, isOverdue, type InvoiceStatus } from "@/lib/invoices";
import { buildCustomerActivity } from "@/lib/customer-activity";
import { CustomerActivityTimeline } from "@/components/customer-activity-timeline";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session.activeOrganizationId) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      equipment: { include: { equipmentType: true }, orderBy: { createdAt: "desc" } },
      workOrders: { include: { equipment: { include: { equipmentType: true } } }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer || customer.organizationId !== organizationId) notFound();

  const workOrdersWithLabel = customer.workOrders.map((wo) => ({
    ...wo,
    equipmentLabel: [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment",
  }));

  const activeWorkOrders = customer.workOrders.filter((wo) => wo.status !== "closed" && wo.status !== "declined").length;
  const totalInvoiced = customer.invoices.filter((inv) => inv.status !== "void").reduce((sum, inv) => sum + Number(inv.total), 0);
  const outstanding = customer.invoices.filter((inv) => inv.status === "sent" || inv.status === "viewed").reduce((sum, inv) => sum + Number(inv.total), 0);

  const activity = buildCustomerActivity({
    customerCreatedAt: customer.createdAt,
    workOrders: workOrdersWithLabel.map((wo) => ({ id: wo.id, status: wo.status, complaint: wo.complaint, equipmentLabel: wo.equipmentLabel, createdAt: wo.createdAt, closedAt: wo.closedAt })),
    invoices: customer.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      total: inv.total.toString(),
      createdAt: inv.createdAt,
      sentAt: inv.sentAt,
      paidAt: inv.paidAt,
      voidedAt: inv.voidedAt,
    })),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs mb-1">
          <Link href="/customers" className="font-semibold text-brand-600">
            Customers
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              <CustomersIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {customer.name}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ") || "No contact info on file"}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                Customer since {customer.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/new?customerId=${customer.id}`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              + New Invoice
            </Link>
            <Link
              href={`/work-orders/new?customerId=${customer.id}`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              + New Work Order
            </Link>
            <Link
              href={`/customers/${customer.id}/edit`}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Edit
            </Link>
            <Link
              href={`/customers/${customer.id}/equipment/new`}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
            >
              + Add Equipment
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Equipment
          </div>
          <div className="num text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>
            {customer.equipment.length}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Work Orders
          </div>
          <div className="num text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>
            {customer.workOrders.length}
            {activeWorkOrders > 0 && (
              <span className="text-xs font-semibold ml-1.5" style={{ color: "var(--color-warning-text)" }}>
                · {activeWorkOrders} active
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Total Invoiced
          </div>
          <div className="num text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>
            ${totalInvoiced.toFixed(2)}
          </div>
        </div>
        <div
          className="rounded-xl p-4"
          style={
            outstanding > 0
              ? { background: "var(--color-error-subtle)", border: "1px solid var(--color-error-border)" }
              : { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }
          }
        >
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: outstanding > 0 ? "var(--color-error-text)" : "var(--text-muted)" }}>
            Outstanding
          </div>
          <div className="num text-xl font-extrabold mt-1" style={{ color: outstanding > 0 ? "var(--color-error-text)" : "var(--text-primary)" }}>
            ${outstanding.toFixed(2)}
          </div>
        </div>
      </div>

      {customer.notes && (
        <div className="rounded-lg p-3 text-xs max-w-2xl" style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
          {customer.notes}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Equipment ({customer.equipment.length})
        </h2>
        <EquipmentMiniList
          customerId={customer.id}
          showAddLink={false}
          equipment={customer.equipment.map((eq) => ({
            id: eq.id,
            label: [eq.make, eq.model].filter(Boolean).join(" / ") || eq.equipmentType?.name || "Unnamed equipment",
            typeName: eq.equipmentType?.name ?? null,
            serialNumber: eq.serialNumber,
            photoKey: eq.photoKey,
          }))}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Work Orders ({customer.workOrders.length})
        </h2>
        {workOrdersWithLabel.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No work orders yet.
          </p>
        ) : (
          <div className="dt-container">
            <div className="dt-scroll">
              <table className="dt-table">
                <thead className="dt-head">
                  <tr>
                    <th className="dt-th text-left">Equipment</th>
                    <th className="dt-th text-left">Complaint</th>
                    <th className="dt-th text-left">Status</th>
                    <th className="dt-th text-left">Date</th>
                    <th className="dt-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrdersWithLabel.map((wo) => {
                    const status = wo.status as WorkOrderStatus;
                    return (
                      <tr key={wo.id} className="dt-row">
                        <td className="dt-td text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {wo.equipmentLabel}
                        </td>
                        <td className="dt-td text-sm" style={{ color: "var(--text-secondary)" }}>
                          {wo.complaint}
                        </td>
                        <td className="dt-td">
                          <span className={`dt-badge dt-badge--${WO_STATUS_BADGE[status]}`}>
                            <span className="dt-badge-dot" />
                            {WO_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                          {wo.createdAt.toLocaleDateString()}
                        </td>
                        <td className="dt-td text-right">
                          <Link href={`/work-orders/${wo.id}`} className="text-[11px] font-bold text-brand-600">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Invoices ({customer.invoices.length})
        </h2>
        {customer.invoices.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No invoices yet.
          </p>
        ) : (
          <div className="dt-container">
            <div className="dt-scroll">
              <table className="dt-table">
                <thead className="dt-head">
                  <tr>
                    <th className="dt-th text-left">Invoice</th>
                    <th className="dt-th text-left">Status</th>
                    <th className="dt-th text-left">Total</th>
                    <th className="dt-th text-left">Date</th>
                    <th className="dt-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map((inv) => {
                    const status = inv.status as InvoiceStatus;
                    const overdue = isOverdue(inv.status, inv.dueDate);
                    return (
                      <tr key={inv.id} className="dt-row">
                        <td className="dt-td num text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {inv.invoiceNumber}
                        </td>
                        <td className="dt-td">
                          <span className={`dt-badge dt-badge--${overdue ? "error" : INV_STATUS_BADGE[status]}`}>
                            <span className="dt-badge-dot" />
                            {overdue ? "Overdue" : INV_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="dt-td num text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          ${inv.total.toString()}
                        </td>
                        <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                          {inv.createdAt.toLocaleDateString()}
                        </td>
                        <td className="dt-td text-right">
                          <Link href={`/invoices/${inv.id}`} className="text-[11px] font-bold text-brand-600">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Activity
        </h2>
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <CustomerActivityTimeline entries={activity} />
        </div>
      </div>
    </div>
  );
}
