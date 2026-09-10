import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOARD_STATUSES, STATUS_LABELS, STATUS_BADGE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function WorkOrdersBoardPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const [workOrders, shopProfile] = organizationId
    ? await Promise.all([
        prisma.workOrder.findMany({
          where: showAll ? { organizationId } : { organizationId, status: { in: BOARD_STATUSES } },
          orderBy: { updatedAt: "desc" },
          include: { customer: true, equipment: { include: { equipmentType: true } } },
        }),
        prisma.shopProfile.findUnique({ where: { organizationId } }),
      ])
    : [[], null];

  const agingDays = shopProfile?.agingAlertDays ?? 14;
  const columns = showAll ? [...BOARD_STATUSES, "closed" as const, "declined" as const] : BOARD_STATUSES;
  const now = getNow();

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Work Orders
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            The ticket board — every repair, start to finish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={showAll ? "/work-orders" : "/work-orders?all=1"}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-slate-50"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            {showAll ? "Hide closed/declined" : "Show closed/declined"}
          </Link>
          <Link
            href="/work-orders/new"
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition"
          >
            + New Work Order
          </Link>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((status) => {
          const items = workOrders.filter((wo) => wo.status === status);
          return (
            <div key={status} className="flex-1 min-w-[260px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {STATUS_LABELS[status as WorkOrderStatus]}
                </h2>
                <span className="text-[11px] font-bold num" style={{ color: "var(--text-muted)" }}>
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="rounded-lg p-4 text-center text-[11px]" style={{ background: "var(--bg-surface-subtle)", border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}>
                    Nothing here
                  </div>
                )}
                {items.map((wo) => {
                  const isAging = wo.status === "readyForPickup" && wo.readyForPickupAt && (now - wo.readyForPickupAt.getTime()) / 86400000 > agingDays;
                  const equipmentLabel = [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" ") || wo.equipment.equipmentType?.name || "Equipment";
                  return (
                    <Link
                      key={wo.id}
                      href={`/work-orders/${wo.id}`}
                      className="block rounded-lg p-3 hover:shadow-md transition"
                      style={{ background: "var(--bg-surface)", border: isAging ? "1px solid var(--color-error-border)" : "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`dt-badge dt-badge--${isAging ? "error" : STATUS_BADGE[status as WorkOrderStatus]}`}>
                          <span className="dt-badge-dot" />
                          {isAging ? `Ready · ${Math.floor((now - wo.readyForPickupAt!.getTime()) / 86400000)}d` : STATUS_LABELS[status as WorkOrderStatus]}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {timeAgo(wo.updatedAt)}
                        </span>
                      </div>
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {wo.customer.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {equipmentLabel}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
