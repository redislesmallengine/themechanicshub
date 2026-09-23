import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceIcon, SearchIcon } from "@/components/icons";
import {
  STATUS_LABELS,
  STATUS_BADGE,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPE_BADGE,
  isOverdue,
  isEditable,
  type InvoiceStatus,
  type InvoiceType,
} from "@/lib/invoices";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }> }) {
  const { q, status, type, page: pageRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();
  const statusFilter = status && (INVOICE_STATUSES as readonly string[]).includes(status) ? status : undefined;
  const typeFilter = type && (INVOICE_TYPES as readonly string[]).includes(type) ? type : undefined;

  const where = organizationId
    ? {
        organizationId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter ? { invoiceType: typeFilter } : {}),
        ...(searchTerm
          ? {
              OR: [
                { invoiceNumber: { contains: searchTerm, mode: "insensitive" as const } },
                { customer: { name: { contains: searchTerm, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      }
    : undefined;

  const [invoices, total, canDelete, canUpdate, membership] = organizationId
    ? await Promise.all([
        prisma.invoice.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { customer: true, lineItems: { select: { partId: true } }, _count: { select: { combinedWorkOrders: true } } },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.invoice.count({ where }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["delete"] } } }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["update"] } } }),
        prisma.member.findFirst({ where: { organizationId, userId: session!.user.id } }),
      ])
    : [[], 0, { success: false as const }, { success: false as const }, null];
  const isOwner = membership?.role === "owner";

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
        <select
          name="type"
          defaultValue={type ?? ""}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">All types</option>
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {INVOICE_TYPE_LABELS[t]}
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
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q || status || type ? "No invoices match those filters." : "No invoices yet — generate one from a work order that's ready for pickup, or create one directly."}
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
                      <div className="flex flex-wrap gap-1">
                        <span className={`dt-badge dt-badge--${INVOICE_TYPE_BADGE[invType]}`}>
                          <span className="dt-badge-dot" />
                          {INVOICE_TYPE_LABELS[invType]}
                        </span>
                        {inv._count.combinedWorkOrders > 0 && (
                          <span className="dt-badge dt-badge--info">
                            <span className="dt-badge-dot" />
                            Multi-Equipment
                          </span>
                        )}
                      </div>
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
                    <td className="dt-td text-right">
                      <div className="flex justify-end items-center gap-3">
                        {isEditable(invStatus) && canUpdate.success && (
                          <Link href={`/invoices/${inv.id}`} className="text-[11px] font-bold text-brand-600">
                            Edit
                          </Link>
                        )}
                        {(invStatus === "draft" || invStatus === "void" || isOwner) && canDelete.success && (
                          <DeleteInvoiceButton invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} status={invStatus} hasInventoryLines={inv.lineItems.some((l) => !!l.partId)} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/invoices" params={{ q: searchTerm, status: statusFilter, type: typeFilter }} />
    </div>
  );
}
