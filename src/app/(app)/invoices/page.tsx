import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceIcon, SearchIcon } from "@/components/icons";
import {
  STATUS_LABELS,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPE_BADGE,
  isEditable,
  invoiceChip,
  type InvoiceStatus,
  type InvoiceType,
} from "@/lib/invoices";
import { STATUS_LABELS as JOB_STATUS_LABELS, STATUS_BADGE as JOB_STATUS_BADGE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { Pagination } from "@/components/pagination";
import { SortTh } from "@/components/sortable-th";
import { parseSort, sortQuery } from "@/lib/sort";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;
// "number" sorts by creation time: invoice numbers are handed out in order, and a plain text sort would put INV-999 after INV-1056.
const SORT_FIELDS = ["number", "customer", "type", "status", "total", "due"] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; payer?: string; page?: string; sort?: string; dir?: string }> }) {
  const { q, status, type, payer, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const searchTerm = q?.trim();
  // Besides each real status: "unpaid" (sent or viewed), "overdue" (unpaid and past its due date), and "open" (anything not yet paid, drafts included).
  const statusFilter = status && ((INVOICE_STATUSES as readonly string[]).includes(status) || ["unpaid", "overdue", "open"].includes(status)) ? status : undefined;
  const payerFilter = payer === "warranty" || payer === "customer" ? payer : undefined;
  const today = new Date(getNow());
  function statusWhereFor(s: string | undefined): Prisma.InvoiceWhereInput {
    if (!s) return {};
    if (s === "unpaid") return { status: { in: ["sent", "viewed"] } };
    if (s === "overdue") return { status: { in: ["sent", "viewed"] }, dueDate: { lt: today } };
    if (s === "open") return { status: { in: ["draft", "sent", "viewed"] } };
    return { status: s };
  }
  const typeFilter = type && (INVOICE_TYPES as readonly string[]).includes(type) ? type : undefined;
  const sort = parseSort(sortRaw, dirRaw, SORT_FIELDS, { field: "number", dir: "desc" });
  const filterParams = { q: searchTerm, status: statusFilter, type: typeFilter, payer: payerFilter };
  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
    sort.field === "customer"
      ? { customer: { name: sort.dir } }
      : sort.field === "type"
        ? { invoiceType: sort.dir }
        : sort.field === "status"
          ? { status: sort.dir }
          : sort.field === "total"
            ? { total: sort.dir }
            : sort.field === "due"
              ? { dueDate: sort.dir }
              : { createdAt: sort.dir },
    { id: "asc" },
  ];

  const where = organizationId
    ? {
        organizationId,
        ...statusWhereFor(statusFilter),
        ...(payerFilter ? { payerType: payerFilter } : {}),
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

  const [invoices, total, canDelete, canUpdate, membership, chipCounts] = organizationId
    ? await Promise.all([
        prisma.invoice.findMany({
          where,
          orderBy,
          include: {
            customer: true,
            warrantyProvider: true,
            lineItems: { select: { partId: true } },
            _count: { select: { combinedWorkOrders: true } },
            workOrder: { select: { status: true } },
          },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        prisma.invoice.count({ where }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["delete"] } } }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { invoice: ["update"] } } }),
        prisma.member.findFirst({ where: { organizationId, userId: session!.user.id } }),
        Promise.all([
          prisma.invoice.count({ where: { organizationId, status: "draft" } }),
          prisma.invoice.count({ where: { organizationId, ...statusWhereFor("unpaid") } }),
          prisma.invoice.count({ where: { organizationId, ...statusWhereFor("overdue") } }),
          prisma.invoice.count({ where: { organizationId, payerType: "warranty", ...statusWhereFor("open") } }),
          prisma.invoice.count({ where: { organizationId, status: "paid" } }),
        ]),
      ])
    : [[], 0, { success: false as const }, { success: false as const }, null, [0, 0, 0, 0, 0]];
  const isOwner = membership?.role === "owner";

  // One-click views, each a plain link that keeps the search and type but sets its own status / payer.
  function chipHref(chipStatus?: string, chipPayer?: string) {
    const sp = new URLSearchParams();
    if (searchTerm) sp.set("q", searchTerm);
    if (typeFilter) sp.set("type", typeFilter);
    if (chipStatus) sp.set("status", chipStatus);
    if (chipPayer) sp.set("payer", chipPayer);
    for (const [key, value] of Object.entries(sortQuery(sort))) if (value) sp.set(key, value);
    const qs = sp.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  }
  const chips: { label: string; count?: number; status?: string; payer?: string }[] = [
    { label: "All" },
    { label: "Drafts", count: chipCounts[0], status: "draft" },
    { label: "Unpaid", count: chipCounts[1], status: "unpaid" },
    { label: "Overdue", count: chipCounts[2], status: "overdue" },
    { label: "Warranty open", count: chipCounts[3], status: "open", payer: "warranty" },
    { label: "Paid", count: chipCounts[4], status: "paid" },
  ];

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

      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip) => {
          const on = (chip.status ?? "") === (statusFilter ?? "") && (chip.payer ?? "") === (payerFilter ?? "");
          return (
            <Link
              key={chip.label}
              href={chipHref(chip.status, chip.payer)}
              aria-current={on ? "true" : undefined}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: on ? "var(--color-brand-600)" : "var(--bg-surface)",
                color: on ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${on ? "var(--color-brand-600)" : "var(--border-strong)"}`,
                opacity: chip.count === 0 && !on ? 0.55 : 1,
              }}
            >
              {chip.label}
              {chip.count !== undefined && (
                <span className="num text-[11px] px-1.5 rounded-full" style={{ background: on ? "rgba(255,255,255,.22)" : "var(--bg-surface-subtle)", color: on ? "#fff" : "var(--text-secondary)" }}>
                  {chip.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <form method="GET" className="mb-4 flex flex-col sm:flex-row gap-3 max-w-3xl">
        {sort.explicit && sort.field && (
          <>
            <input type="hidden" name="sort" value={sort.field} />
            <input type="hidden" name="dir" value={sort.dir} />
          </>
        )}
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
          <option value="unpaid">Unpaid (sent or viewed)</option>
          <option value="overdue">Overdue</option>
          <option value="open">Not yet paid (incl. drafts)</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          name="payer"
          defaultValue={payerFilter ?? ""}
          aria-label="Billed to"
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">Billed to anyone</option>
          <option value="customer">Customers</option>
          <option value="warranty">Warranty providers</option>
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
                <SortTh label="Invoice #" field="number" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} firstDir="desc" />
                <SortTh label="Customer" field="customer" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} />
                <SortTh label="Type" field="type" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} />
                <th className="dt-th text-left">Job</th>
                <SortTh label="Invoice" field="status" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} />
                <SortTh label="Total" field="total" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} firstDir="desc" />
                <SortTh label="Due" field="due" sort={sort.field} dir={sort.dir} basePath="/invoices" params={filterParams} firstDir="desc" />
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {q || status || type || payer ? "No invoices match those filters." : "No invoices yet — generate one from a work order that's ready for pickup, or create one directly."}
                  </td>
                </tr>
              )}
              {invoices.map((inv) => {
                const invStatus = inv.status as InvoiceStatus;
                const invType = inv.invoiceType as InvoiceType;
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
                      {inv.payerType === "warranty" && inv.warrantyProvider && (
                        <div className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                          Billed to {inv.warrantyProvider.name}
                        </div>
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
                        {inv.payerType === "warranty" && (
                          <span className="dt-badge dt-badge--info">
                            <span className="dt-badge-dot" />
                            Warranty
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="dt-td">
                      {inv.workOrder ? (
                        <Link href={`/work-orders/${inv.workOrderId}`} className={`dt-badge dt-badge--${JOB_STATUS_BADGE[inv.workOrder.status as WorkOrderStatus] ?? "info"}`} title="Open the job">
                          <span className="dt-badge-dot" />
                          {JOB_STATUS_LABELS[inv.workOrder.status as WorkOrderStatus] ?? inv.workOrder.status}
                        </Link>
                      ) : inv._count.combinedWorkOrders > 0 ? (
                        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {inv._count.combinedWorkOrders} jobs
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td className="dt-td">
                      {(() => {
                        const chip = invoiceChip(inv.status, inv.dueDate, inv.payerType);
                        return (
                          <span className={`dt-badge dt-badge--${chip.badge}`}>
                            <span className="dt-badge-dot" />
                            {chip.label}
                          </span>
                        );
                      })()}
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

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/invoices" params={{ ...filterParams, ...sortQuery(sort) }} />
    </div>
  );
}
