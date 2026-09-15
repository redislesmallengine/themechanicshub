import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceIcon, SearchIcon } from "@/components/icons";
import { STATUS_LABELS, STATUS_BADGE, INVOICE_STATUSES, INVOICE_TYPE_LABELS, INVOICE_TYPE_BADGE, isOverdue, type InvoiceStatus, type InvoiceType } from "@/lib/invoices";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const invoices = organizationId
    ? await prisma.invoice.findMany({
        where: {
          organizationId,
          ...(status && (INVOICE_STATUSES as readonly string[]).includes(status) ? { status } : {}),
          ...(q?.trim()
            ? {
                OR: [
                  { invoiceNumber: { contains: q.trim(), mode: "insensitive" } },
                  { customer: { name: { contains: q.trim(), mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      })
    : [];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Invoices
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            From a work order, or created directly for a parts-only or walk-in sale — search, filter, and track payment status.
          </p>
        </div>
        <Link href="/invoices/new" className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm whitespace-nowrap">
          + New Invoice
        </Link>
      </div>

      <form method="GET" className="mb-4 flex flex-col sm:flex-row gap-3 max-w-2xl">
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by invoice # or customer…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Filter
        </button>
      </form>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Invoice #</th>
                <th className="dt-th text-left">Customer</th>
                <th className="dt-th text-left">Type</th>
                <th className="dt-th text-left">Status</th>
                <th className="dt-th text-left">Total</th>
                <th className="dt-th text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q || status ? "No invoices match those filters." : "No invoices yet — generate one from a work order that's ready for pickup, or create one directly."}
                  </td>
                </tr>
              )}
              {invoices.map((inv) => {
                const invStatus = inv.status as InvoiceStatus;
                const invType = inv.invoiceType as InvoiceType;
                const overdue = isOverdue(inv.status, inv.dueDate);
                return (
                  <tr key={inv.id} className="dt-row">
                    <td className="dt-td">
                      <Link href={`/invoices/${inv.id}`} className="flex items-center gap-2 font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                        <InvoiceIcon className="w-3.5 h-3.5 text-sky-400" />
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="dt-td">
                      {inv.customer ? (
                        <Link href={`/customers/${inv.customerId}`} className="text-sm font-semibold text-brand-600 hover:underline">
                          {inv.customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          No Customer Info
                        </span>
                      )}
                    </td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${INVOICE_TYPE_BADGE[invType]}`}>
                        <span className="dt-badge-dot" />
                        {INVOICE_TYPE_LABELS[invType]}
                      </span>
                    </td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${overdue ? "error" : STATUS_BADGE[invStatus]}`}>
                        <span className="dt-badge-dot" />
                        {overdue ? "Overdue" : STATUS_LABELS[invStatus]}
                      </span>
                    </td>
                    <td className="dt-td num text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      ${inv.total.toString()}
                    </td>
                    <td className="dt-td num text-sm" style={{ color: "var(--text-muted)" }}>
                      {inv.dueDate.toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
