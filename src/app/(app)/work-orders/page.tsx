import Link from "next/link";
import { PhoneLink } from "@/components/phone-link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { DeleteWorkOrderButton } from "@/components/delete-work-order-button";
import { SortTh } from "@/components/sortable-th";
import { WorkOrderQuickAction } from "@/components/work-order-quick-action";
import { WorkOrderStatusMover } from "@/components/work-order-status-mover";
import { parseSort, sortQuery } from "@/lib/sort";
import { BOARD_STATUSES, STATUS_LABELS, STATUS_BADGE, NEEDS_BILLING_WHERE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";
import { invoiceChip } from "@/lib/invoices";
import { MarkInvoiceSentButton } from "@/components/mark-invoice-sent-button";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
// A shop's active list is dozens of rows, not thousands -- fetch it all so
// "needs attention first" can sort across the whole set, then page the
// sorted result. The cap only matters for the closed/declined history view.
const FETCH_CAP = 500;
const DAY_MS = 86400000;
const AWAITING_ALERT_DAYS = 2;
const HISTORY_STATUSES = ["closed", "declined"];

// Pipeline order -- what sorting by Status (and Next step, which follows from it) means.
const STATUS_RANK = ["droppedOff", "diagnosing", "awaitingApproval", "inRepair", "readyForPickup", "closed", "declined"];
const SORT_FIELDS = ["customer", "equipment", "status", "invoice", "technician", "stage", "next"] as const;
// Where an invoice stands, for sorting the Invoice column: none, then in the order money moves.
const INVOICE_RANK = ["none", "draft", "sent", "viewed", "overdue", "paid", "void"];

const FILTER_STATUSES = ["droppedOff", "diagnosing", "awaitingApproval", "inRepair", "readyForPickup"] as const;


function fmtAge(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string; sort?: string; dir?: string }> }) {
  const { q, status, page: pageRaw, pageSize: pageSizeRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const requestedSize = Number.parseInt(pageSizeRaw ?? "", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE;
  const searchTerm = q?.trim();
  // No column picked = the page's own order (needs-attention first, then most recently touched).
  const sort = parseSort(sortRaw, dirRaw, SORT_FIELDS, { field: null, dir: "asc" });
  const filter = status === "history" || status === "bench" || status === "needsBilling" || (FILTER_STATUSES as readonly string[]).includes(status ?? "") ? status : undefined;

  const statusWhere = filter === "history" ? { in: HISTORY_STATUSES } : filter === "bench" ? { in: ["diagnosing", "inRepair"] } : filter ? filter : { in: BOARD_STATUSES as string[] };
  const where = organizationId
    ? {
        organizationId,
        ...(filter === "needsBilling" ? { AND: [NEEDS_BILLING_WHERE] } : { status: statusWhere }),
        ...(searchTerm
          ? {
              OR: [
                { customer: { name: { contains: searchTerm, mode: "insensitive" as const } } },
                { customer: { phone: { contains: searchTerm, mode: "insensitive" as const } } },
                { customer: { email: { contains: searchTerm, mode: "insensitive" as const } } },
                { equipment: { make: { contains: searchTerm, mode: "insensitive" as const } } },
                { equipment: { model: { contains: searchTerm, mode: "insensitive" as const } } },
                { equipment: { serialNumber: { contains: searchTerm, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      }
    : undefined;

  const [workOrders, statusCounts, shopProfile, canUpdate, canDelete, membership, needsBillingCount] = organizationId
    ? await Promise.all([
        prisma.workOrder.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: FETCH_CAP,
          include: {
            customer: { select: { name: true, phone: true, email: true } },
            equipment: { select: { make: true, model: true, equipmentType: { select: { name: true } } } },
            assignedTo: { select: { name: true } },
            invoice: { select: { id: true, status: true, dueDate: true, payerType: true } },
            combinedInto: { select: { invoiceId: true, invoice: { select: { status: true, dueDate: true, payerType: true } } } },
            parts: { select: { id: true } },
          },
        }),
        prisma.workOrder.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
        prisma.shopProfile.findUnique({ where: { organizationId }, select: { agingAlertDays: true } }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { workOrder: ["update"] } } }),
        auth.api.hasPermission({ headers: reqHeaders, body: { permissions: { workOrder: ["delete"] } } }),
        prisma.member.findFirst({ where: { organizationId, userId: session!.user.id } }),
        prisma.workOrder.count({ where: { organizationId, ...NEEDS_BILLING_WHERE } }),
      ])
    : [[], [], null, { success: false as const }, { success: false as const }, null, 0];

  const isOwner = membership?.role === "owner";
  const agingDays = shopProfile?.agingAlertDays ?? 14;
  const now = getNow();

  const counts: Record<string, number> = {};
  for (const row of statusCounts) counts[row.status] = row._count._all;
  const activeCount = BOARD_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  function isAttention(wo: (typeof workOrders)[number]): boolean {
    if (wo.status === "readyForPickup" && wo.readyForPickupAt) return (now - wo.readyForPickupAt.getTime()) / DAY_MS > agingDays;
    if (wo.status === "awaitingApproval" && wo.awaitingApprovalAt) return (now - wo.awaitingApprovalAt.getTime()) / DAY_MS >= AWAITING_ALERT_DAYS;
    return false;
  }

  // The moment the job entered its current stage. Diagnosing has no
  // dedicated timestamp, so it falls back to last-updated.
  function stageSince(wo: (typeof workOrders)[number]): Date {
    switch (wo.status) {
      case "droppedOff":
        return wo.createdAt;
      case "awaitingApproval":
        return wo.awaitingApprovalAt ?? wo.updatedAt;
      case "inRepair":
        return wo.decidedAt ?? wo.updatedAt;
      case "readyForPickup":
        return wo.readyForPickupAt ?? wo.updatedAt;
      case "closed":
        return wo.closedAt ?? wo.updatedAt;
      default:
        return wo.updatedAt;
    }
  }

  function equipmentLabelOf(wo: (typeof workOrders)[number]): string {
    return [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment";
  }

  // Default: needs-attention jobs first, then most recently touched (the query already orders by
  // updatedAt; Array.sort is stable). A clicked column header replaces that with a plain sort on
  // the whole fetched set, with the same stable tie-break.
  const sortKey = (wo: (typeof workOrders)[number]): string | number => {
    switch (sort.field) {
      case "customer":
        return wo.customer.name.toLowerCase();
      case "equipment":
        return equipmentLabelOf(wo).toLowerCase();
      case "technician":
        return wo.assignedTo?.name.toLowerCase() ?? "\uffff"; // unassigned last
      case "invoice": {
        const inv = wo.invoice ?? wo.combinedInto?.invoice ?? null;
        return INVOICE_RANK.indexOf(inv ? (invoiceChip(inv.status, inv.dueDate, inv.payerType, now).label === "Overdue" ? "overdue" : inv.status) : "none");
      }
      case "stage":
        return now - stageSince(wo).getTime();
      default:
        return STATUS_RANK.indexOf(wo.status); // "status" and "next"
    }
  };
  const sorted = sort.field
    ? [...workOrders].sort((a, b) => {
        const ka = sortKey(a);
        const kb = sortKey(b);
        const cmp = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
        return sort.dir === "desc" ? -cmp : cmp;
      })
    : [...workOrders].sort((a, b) => Number(isAttention(b)) - Number(isAttention(a)));
  const attentionCount = sorted.filter(isAttention).length;
  const total = sorted.length;
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

  function chipHref(value?: string): string {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (searchTerm) params.set("q", searchTerm);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
    for (const [key, value] of Object.entries(sortQuery(sort))) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/work-orders?${qs}` : "/work-orders";
  }
  const filterParams = { q: searchTerm, status: filter, pageSize: pageSize !== DEFAULT_PAGE_SIZE ? String(pageSize) : undefined };

  const chips: { value?: string; label: string; count?: number; dashed?: boolean }[] = [
    { value: undefined, label: "All active", count: activeCount },
    { value: "needsBilling", label: "Needs billing", count: needsBillingCount },
    ...FILTER_STATUSES.map((s) => ({ value: s as string, label: STATUS_LABELS[s], count: counts[s] ?? 0 })),
    { value: "history", label: "Closed / Declined", dashed: true },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Work Orders
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {activeCount} active · {attentionCount > 0 ? `${attentionCount} need attention` : "nothing needs attention"}{needsBillingCount > 0 ? ` · ${needsBillingCount} need billing` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="GET" className="relative">
            {filter && <input type="hidden" name="status" value={filter} />}
            {pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="pageSize" value={pageSize} />}
            {sort.explicit && sort.field && (
              <>
                <input type="hidden" name="sort" value={sort.field} />
                <input type="hidden" name="dir" value={sort.dir} />
              </>
            )}
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search customer, equipment…"
              className="w-56 pl-9 pr-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            />
          </form>
          <Link
            href="/work-orders/quick"
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition whitespace-nowrap hover:bg-slate-50"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            ⚡ Quick Job
          </Link>
          <Link href="/work-orders/new" className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition whitespace-nowrap">
            + New Work Order
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip) => {
          const on = chip.value === filter;
          const zero = chip.count === 0 && !on;
          return (
            <Link
              key={chip.label}
              href={chipHref(chip.value)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: on ? "var(--color-brand-600)" : "var(--bg-surface)",
                color: on ? "#fff" : "var(--text-secondary)",
                border: `1px ${chip.dashed ? "dashed" : "solid"} ${on ? "var(--color-brand-600)" : "var(--border-strong)"}`,
                opacity: zero ? 0.55 : 1,
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

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table">
            <thead className="dt-head">
              <tr>
                <SortTh label="Customer" field="customer" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <SortTh label="Equipment" field="equipment" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <SortTh label="Status" field="status" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <SortTh label="Invoice" field="invoice" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <SortTh label="Technician" field="technician" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <SortTh label="In this stage" field="stage" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} firstDir="desc" />
                <SortTh label="Next step" field="next" sort={sort.field} dir={sort.dir} basePath="/work-orders" params={filterParams} />
                <th className="dt-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    {searchTerm || filter ? "No work orders match that." : "No active work orders — create one to get started."}
                  </td>
                </tr>
              )}
              {rows.map((wo) => {
                const woStatus = wo.status as WorkOrderStatus;
                const attention = isAttention(wo);
                const since = stageSince(wo);
                const ageMs = now - since.getTime();
                const equipmentLabel = equipmentLabelOf(wo);
                const invoiceId = wo.invoice?.id ?? wo.combinedInto?.invoiceId ?? null;
                const linkedInvoice = wo.invoice ?? wo.combinedInto?.invoice ?? null;
                const moneyChip = linkedInvoice ? invoiceChip(linkedInvoice.status, linkedInvoice.dueDate, linkedInvoice.payerType, now) : null;
                const jobDone = woStatus === "readyForPickup" || woStatus === "closed";
                const draftInvoiceId = jobDone && linkedInvoice?.status === "draft" ? invoiceId : null;
                const billingFlag = draftInvoiceId ? "Invoice still a draft" : woStatus === "readyForPickup" && !linkedInvoice ? "No invoice yet" : null;
                const aging = woStatus === "readyForPickup" && attention;
                const nextStep =
                  woStatus === "droppedOff"
                    ? { label: "Start diagnosis →", href: `/work-orders/${wo.id}` }
                    : woStatus === "awaitingApproval"
                      ? { label: "Follow up →", href: `/work-orders/${wo.id}` }
                      : (woStatus === "readyForPickup" || woStatus === "closed") && invoiceId
                        ? { label: "View invoice →", href: `/invoices/${invoiceId}` }
                        : woStatus === "readyForPickup"
                          ? { label: "Bill & collect →", href: `/work-orders/${wo.id}#finish` }
                          : woStatus === "inRepair"
                            ? { label: "Finish & collect →", href: `/work-orders/${wo.id}#finish` }
                            : { label: "Open →", href: `/work-orders/${wo.id}` };
                const showDelete = (woStatus === "droppedOff" || woStatus === "declined" || isOwner) && !invoiceId && canDelete.success;
                return (
                  <tr key={wo.id} className="dt-row" style={attention ? { background: "var(--color-error-subtle)" } : billingFlag ? { background: "var(--color-warning-subtle)" } : undefined}>
                    <td className="dt-td">
                      <Link href={`/work-orders/${wo.id}`} className="font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                        {wo.customer.name}
                      </Link>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {wo.customer.phone ? <PhoneLink phone={wo.customer.phone} /> : (wo.customer.email ?? "")}
                      </div>
                    </td>
                    <td className="dt-td text-sm">{equipmentLabel}</td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${aging ? "error" : STATUS_BADGE[woStatus]}`}>
                        <span className="dt-badge-dot" />
                        {aging ? `Ready · ${Math.floor(ageMs / DAY_MS)}d` : STATUS_LABELS[woStatus]}
                      </span>
                    </td>
                    <td className="dt-td">
                      {moneyChip ? (
                        <span className={`dt-badge dt-badge--${moneyChip.badge}`}>
                          <span className="dt-badge-dot" />
                          {moneyChip.label}
                        </span>
                      ) : jobDone ? (
                        <span className="dt-badge dt-badge--warning">
                          <span className="dt-badge-dot" />
                          None yet
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          —
                        </span>
                      )}
                      {billingFlag && (
                        <div className="text-[10px] font-bold mt-0.5" style={{ color: "var(--color-warning-text)" }}>
                          ⚑ {billingFlag}
                        </div>
                      )}
                    </td>
                    <td className="dt-td text-sm" style={{ color: wo.assignedTo ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {wo.assignedTo?.name ?? "Unassigned"}
                    </td>
                    <td className="dt-td num text-sm font-semibold" style={{ color: attention ? "var(--color-error-text)" : "var(--text-secondary)" }}>
                      {fmtAge(ageMs)}
                    </td>
                    <td className="dt-td">
                      {woStatus === "droppedOff" || woStatus === "diagnosing" ? (
                        <WorkOrderQuickAction workOrderId={wo.id} status={woStatus} />
                      ) : draftInvoiceId ? (
                        <div className="flex items-center gap-2">
                          <MarkInvoiceSentButton
                            invoiceId={draftInvoiceId}
                            warranty={linkedInvoice?.payerType === "warranty"}
                            label={linkedInvoice?.payerType === "warranty" ? "Mark submitted →" : "Mark sent →"}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
                          />
                          <Link href={nextStep.href} className="text-[11px] font-bold text-brand-600 whitespace-nowrap">
                            View
                          </Link>
                        </div>
                      ) : (
                        <Link href={nextStep.href} className="text-xs font-bold text-brand-600 whitespace-nowrap">
                          {nextStep.label}
                        </Link>
                      )}
                    </td>
                    <td className="dt-td text-right">
                      <div className="flex justify-end items-center gap-3">
                        {canUpdate.success && <WorkOrderStatusMover workOrderId={wo.id} status={woStatus} hasEstimate={!!wo.estimateAmount} hasInvoice={!!invoiceId} draftInvoiceId={draftInvoiceId} compact />}
                        {canUpdate.success && (
                          <Link href={`/work-orders/${wo.id}`} className="text-[11px] font-bold text-brand-600">
                            Edit
                          </Link>
                        )}
                        {showDelete && <DeleteWorkOrderButton workOrderId={wo.id} equipmentLabel={equipmentLabel} status={woStatus} hasInventoryLines={wo.parts.length > 0} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/work-orders"
        params={{ q: searchTerm, status: filter, ...sortQuery(sort) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  );
}
