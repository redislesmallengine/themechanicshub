import Link from "next/link";
import {
  getShopFloorCounts,
  getOpenWorkOrders,
  getOpenWorkOrderCount,
  getRevenueTiles,
  getRevenueTrend,
  getWorkOrdersByStatus,
  getOpenedVsClosed,
  getRevenueByType,
  getTopCustomers,
  getTopParts,
  getTechnicianWorkload,
  getLowStockParts,
  getInventoryValue,
  getCustomerStats,
} from "@/lib/dashboard";
import { STATUS_LABELS as WO_STATUS_LABELS, STATUS_BADGE as WO_STATUS_BADGE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";
import { StatTile } from "@/components/dashboard/stat-tile";
import { RevenueTrendChartSvg, WorkOrdersByStatusChartSvg, OpenedVsClosedChartSvg, RevenueByTypeDonutSvg } from "@/components/dashboard/charts";
import { Pagination } from "@/components/pagination";

export const OPEN_WORK_ORDERS_PAGE_SIZES = [5, 10, 15, 25, 50] as const;
export const OPEN_WORK_ORDERS_DEFAULT_PAGE_SIZE = 5;

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPercentChange(current: number, previous: number): string | undefined {
  if (previous <= 0) return current > 0 ? "new this month" : undefined;
  const pct = ((current - previous) / previous) * 100;
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(0)}% vs last month`;
}

function RankedBarList({ rows, valueLabel }: { rows: { id: string; label: string; value: number; valueDisplay: string }[]; valueLabel: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nothing to show yet.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="flex justify-between text-[11.5px] mb-1">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {r.label}
            </span>
            <span className="num font-bold" style={{ color: "var(--text-primary)" }}>
              {r.valueDisplay}
            </span>
          </div>
          <div className="h-1.5 rounded" style={{ background: "var(--bg-surface-subtle)" }}>
            <div className="h-full rounded" style={{ width: `${Math.max((r.value / max) * 100, 4)}%`, background: "var(--color-brand-600)" }} />
          </div>
        </div>
      ))}
      <span className="sr-only">{valueLabel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop Floor — visible to everyone; no permission check needed to fetch it.
// ---------------------------------------------------------------------------

export async function ShopFloorTiles({ organizationId, agingDays }: { organizationId: string; agingDays: number }) {
  const c = await getShopFloorCounts(organizationId, agingDays);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="On the Bench" value={c.onBench.toString()} sub="diagnosing + in repair" />
      <StatTile
        label="Awaiting Approval"
        value={c.awaitingApproval.toString()}
        sub={c.awaitingApproval2Days > 0 ? `${c.awaitingApproval2Days} waiting 2+ days` : "all recent"}
        tone={c.awaitingApproval2Days > 0 ? "warning" : "neutral"}
      />
      <StatTile
        label="Repair Completed"
        value={c.repairCompleted.toString()}
        sub={c.repairCompletedAging > 0 ? `${c.repairCompletedAging} over ${agingDays} days` : "all within range"}
        tone={c.repairCompletedAging > 0 ? "error" : "neutral"}
      />
      <StatTile label="Unpaid Invoices" value={fmtMoney(c.unpaidTotal)} sub={`${c.unpaidCount} invoice${c.unpaidCount === 1 ? "" : "s"}`} />
    </div>
  );
}

export async function OpenWorkOrdersTable({
  organizationId,
  agingDays,
  page,
  pageSize,
}: {
  organizationId: string;
  agingDays: number;
  page: number;
  pageSize: number;
}) {
  const [workOrders, total] = await Promise.all([
    getOpenWorkOrders(organizationId, pageSize, (page - 1) * pageSize),
    getOpenWorkOrderCount(organizationId),
  ]);
  const now = getNow();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5 text-[11px]">
        <span className="font-semibold" style={{ color: "var(--text-muted)" }}>
          Per page:
        </span>
        {OPEN_WORK_ORDERS_PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={size === OPEN_WORK_ORDERS_DEFAULT_PAGE_SIZE ? "/dashboard" : `/dashboard?woSize=${size}`}
            className="px-2 py-0.5 rounded-md font-bold"
            style={
              size === pageSize
                ? { background: "var(--color-brand-600)", color: "#fff" }
                : { background: "var(--bg-surface-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
            }
          >
            {size}
          </Link>
        ))}
      </div>

      <div className="dt-container">
        <div className="dt-scroll">
          <table className="dt-table" style={{ minWidth: 640 }}>
            <thead className="dt-head">
              <tr>
                <th className="dt-th text-left">Customer</th>
                <th className="dt-th text-left">Equipment</th>
                <th className="dt-th text-left">Status</th>
                <th className="dt-th text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="dt-td text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    Nothing open —{" "}
                    <Link href="/work-orders/new" className="font-semibold text-brand-600">
                      create a work order
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {workOrders.map((wo) => {
                const status = wo.status as WorkOrderStatus;
                const isAging = status === "readyForPickup" && wo.readyForPickupAt && (now - wo.readyForPickupAt.getTime()) / 86400000 > agingDays;
                const equipmentLabel = [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" / ") || wo.equipment.equipmentType?.name || "Equipment";
                return (
                  <tr key={wo.id} className="dt-row">
                    <td className="dt-td">
                      <Link href={`/work-orders/${wo.id}`} className="font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                        {wo.customer.name}
                      </Link>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {wo.customer.phone ?? wo.customer.email ?? ""}
                      </div>
                    </td>
                    <td className="dt-td text-sm">{equipmentLabel}</td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${isAging ? "error" : WO_STATUS_BADGE[status]}`}>
                        <span className="dt-badge-dot" />
                        {isAging ? `Ready · ${Math.floor((now - wo.readyForPickupAt!.getTime()) / 86400000)}d` : WO_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="dt-td num text-sm text-right">{timeAgo(wo.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} basePath="/dashboard" params={{ woSize: pageSize !== OPEN_WORK_ORDERS_DEFAULT_PAGE_SIZE ? String(pageSize) : undefined }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue — Owner/Manager only. The page only renders this section's
// Suspense boundary at all when the viewer has invoice:viewMargins, so a
// Technician's dashboard load never runs these queries in the first place.
// ---------------------------------------------------------------------------

export async function RevenueTiles({ organizationId }: { organizationId: string }) {
  const r = await getRevenueTiles(organizationId);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatTile label="Revenue This Month" value={fmtMoney(r.revenueThisMonth)} sub={fmtPercentChange(r.revenueThisMonth, r.revenueLastMonth)} />
      <StatTile label="Outstanding" value={fmtMoney(r.outstanding)} sub="not yet due" />
      <StatTile label="Overdue" value={fmtMoney(r.overdue)} sub={`${r.overdueCount} invoice${r.overdueCount === 1 ? "" : "s"}`} tone={r.overdue > 0 ? "error" : "neutral"} />
      <StatTile label="Avg Invoice" value={fmtMoney(r.avgInvoice30d)} sub="last 30 days" />
      <StatTile label="Parts Margin" value={r.partsMarginPercent === null ? "—" : `${r.partsMarginPercent.toFixed(0)}%`} sub="cost vs. sell, this month" />
    </div>
  );
}

export async function RevenueTrendCard({ organizationId }: { organizationId: string }) {
  const points = await getRevenueTrend(organizationId);
  const last = points[points.length - 1];
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
          Revenue — Last 30 Days
        </div>
        {last && (
          <div className="num text-xs font-bold" style={{ color: "var(--color-success-text)" }}>
            {fmtMoney(last.total)} today
          </div>
        )}
      </div>
      <RevenueTrendChartSvg points={points} />
    </div>
  );
}

export async function WorkOrdersByStatusCard({ organizationId }: { organizationId: string }) {
  const counts = await getWorkOrdersByStatus(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="text-xs font-extrabold mb-2.5" style={{ color: "var(--text-primary)" }}>
        Work Orders by Status
      </div>
      <WorkOrdersByStatusChartSvg counts={counts} />
    </div>
  );
}

export async function OpenedVsClosedCard({ organizationId }: { organizationId: string }) {
  const weeks = await getOpenedVsClosed(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
          Work Orders Opened vs. Closed
        </div>
        <div className="flex gap-2.5 text-[10px] font-bold">
          <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-brand-500)" }} />
            Opened
          </span>
          <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-success-solid)" }} />
            Closed
          </span>
        </div>
      </div>
      <OpenedVsClosedChartSvg weeks={weeks} />
    </div>
  );
}

export async function RevenueByTypeCard({ organizationId }: { organizationId: string }) {
  const items = await getRevenueByType(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="text-xs font-extrabold mb-2.5" style={{ color: "var(--text-primary)" }}>
        Revenue by Invoice Type
      </div>
      <RevenueByTypeDonutSvg items={items} />
    </div>
  );
}

export async function TopCustomersCard({ organizationId }: { organizationId: string }) {
  const customers = await getTopCustomers(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="text-xs font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
        Top Customers by Revenue
      </div>
      <RankedBarList
        valueLabel="revenue"
        rows={customers.map((c) => ({ id: c.id, label: c.name, value: c.total, valueDisplay: fmtMoney(c.total) }))}
      />
    </div>
  );
}

export async function TopPartsCard({ organizationId }: { organizationId: string }) {
  const parts = await getTopParts(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="text-xs font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
        Top-Selling Parts — This Month
      </div>
      <RankedBarList
        valueLabel="units sold"
        rows={parts.map((p) => ({ id: p.id, label: p.name, value: p.quantity, valueDisplay: `${p.quantity} sold` }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function CustomerTiles({ organizationId }: { organizationId: string }) {
  const s = await getCustomerStats(organizationId);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatTile label="New Customers" value={s.newThisMonth.toString()} sub={fmtPercentChange(s.newThisMonth, s.newLastMonth) ?? "this month"} />
      <StatTile label="Repeat-Customer Rate" value={`${s.repeatRatePercent}%`} sub="2+ work orders, all-time" />
      <StatTile
        label="Customers Owing Money"
        value={s.owingCount.toString()}
        sub={`${fmtMoney(s.owingTotal)} outstanding total`}
        tone={s.owingCount > 0 ? "warning" : "neutral"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff & Inventory
// ---------------------------------------------------------------------------

export async function InventoryValueCard({ organizationId }: { organizationId: string }) {
  const v = await getInventoryValue(organizationId);
  return (
    <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Total Inventory Value
        </div>
        <div className="num text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>
          {fmtMoney(v.totalValue)}
        </div>
      </div>
      <div className="text-right text-[10.5px]" style={{ color: "var(--text-muted)" }}>
        {v.partCount} part{v.partCount === 1 ? "" : "s"} in stock
        <br />
        at cost
      </div>
    </div>
  );
}

export async function TechnicianWorkloadCard({ organizationId }: { organizationId: string }) {
  const techs = await getTechnicianWorkload(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="text-xs font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
        Technician Workload — This Month
      </div>
      {techs.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No work orders assigned to anyone yet.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3.5">
            {techs.map((t) => {
              const denom = Math.max(t.active + t.completedThisMonth, 1);
              return (
                <div key={t.userId}>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                      {t.name}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {t.active} active · {t.completedThisMonth} completed
                    </span>
                  </div>
                  <div className="flex gap-0.5 h-2">
                    <div className="rounded-l" style={{ width: `${(t.active / denom) * 100}%`, background: "var(--color-warning-solid)" }} />
                    <div className="rounded-r" style={{ width: `${(t.completedThisMonth / denom) * 100}%`, background: "var(--color-success-solid)" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-3.5 text-[10px] font-bold">
            <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-warning-solid)" }} />
              Active jobs
            </span>
            <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "var(--color-success-solid)" }} />
              Completed
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export async function LowStockCard({ organizationId }: { organizationId: string }) {
  const parts = await getLowStockParts(organizationId);
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
          Low Stock Alert
        </div>
        <Link href="/inventory?stock=low" className="text-[11px] font-bold text-brand-600">
          View Inventory
        </Link>
      </div>
      {parts.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nothing at or below its reorder point.
        </p>
      ) : (
        <div className="flex flex-col">
          {parts.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2"
              style={i < parts.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}
            >
              <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {p.name}
              </span>
              <span className="num text-[11px] font-bold" style={{ color: p.quantityOnHand === 0 ? "var(--color-error-solid)" : "var(--color-warning-solid)" }}>
                {p.quantityOnHand} on hand · reorder at {p.reorderPoint}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
