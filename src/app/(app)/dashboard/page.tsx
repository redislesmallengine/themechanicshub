import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_BADGE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function DashboardPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const organizationId = session?.session.activeOrganizationId;

  const [organization, shopProfile, workOrders, unpaidInvoices] = organizationId
    ? await Promise.all([
        prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
        prisma.shopProfile.findUnique({ where: { organizationId } }),
        prisma.workOrder.findMany({
          where: { organizationId, status: { notIn: ["closed", "declined"] } },
          orderBy: { updatedAt: "desc" },
          include: { customer: true, equipment: { include: { equipmentType: true } } },
        }),
        prisma.invoice.findMany({ where: { organizationId, status: { in: ["sent", "viewed"] } }, select: { total: true } }),
      ])
    : [null, null, [], []];

  const agingDays = shopProfile?.agingAlertDays ?? 14;
  const now = getNow();

  const onBench = workOrders.filter((w) => w.status === "diagnosing" || w.status === "inRepair").length;
  const awaitingApproval = workOrders.filter((w) => w.status === "awaitingApproval");
  const awaitingApproval2Days = awaitingApproval.filter((w) => w.awaitingApprovalAt && (now - w.awaitingApprovalAt.getTime()) / 86400000 >= 2).length;
  const readyForPickup = workOrders.filter((w) => w.status === "readyForPickup");
  const readyOverAging = readyForPickup.filter((w) => w.readyForPickupAt && (now - w.readyForPickupAt.getTime()) / 86400000 > agingDays).length;

  const tiles = [
    { label: "On the Bench", value: onBench.toString(), sub: "diagnosing + in repair" },
    {
      label: "Awaiting Approval",
      value: awaitingApproval.length.toString(),
      sub: awaitingApproval2Days > 0 ? `${awaitingApproval2Days} waiting 2+ days` : "all recent",
      warn: awaitingApproval2Days > 0,
    },
    {
      label: "Ready for Pickup",
      value: readyForPickup.length.toString(),
      sub: readyOverAging > 0 ? `${readyOverAging} over ${agingDays} days` : "all within range",
      warn: readyOverAging > 0,
    },
    {
      label: "Unpaid Invoices",
      value: `$${unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0).toFixed(2)}`,
      sub: `${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Today&apos;s shop-floor snapshot for {organization?.name ?? "your shop"}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-xs)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              {t.label}
            </div>
            <div className="text-2xl font-bold num" style={{ color: "var(--text-primary)" }}>
              {t.value}
            </div>
            <div className="text-xs mt-1" style={{ color: t.warn ? "var(--color-warning-solid)" : "var(--text-muted)", fontWeight: t.warn ? 600 : 400 }}>
              {t.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Open Work Orders
        </h2>
        <Link href="/work-orders" className="text-xs font-semibold text-brand-600">
          View board
        </Link>
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
              {workOrders.slice(0, 15).map((wo) => {
                const status = wo.status as WorkOrderStatus;
                const isAging = status === "readyForPickup" && wo.readyForPickupAt && (now - wo.readyForPickupAt.getTime()) / 86400000 > agingDays;
                const equipmentLabel = [wo.equipment.make, wo.equipment.model].filter(Boolean).join(" ") || wo.equipment.equipmentType?.name || "Equipment";
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
                      <span className={`dt-badge dt-badge--${isAging ? "error" : STATUS_BADGE[status]}`}>
                        <span className="dt-badge-dot" />
                        {isAging ? `Ready · ${Math.floor((now - wo.readyForPickupAt!.getTime()) / 86400000)}d` : STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="dt-td num text-sm text-right">{timeAgo(wo.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {workOrders.length > 15 && (
          <div className="dt-footer">
            <span>Showing 15 of {workOrders.length} open work orders</span>
            <Link href="/work-orders" className="text-xs font-semibold text-brand-600">
              View all
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
