"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { STATUS_LABELS as WO_STATUS_LABELS, STATUS_BADGE as WO_STATUS_BADGE, now as getNow, type WorkOrderStatus } from "@/lib/work-orders";
import { fetchOpenWorkOrdersPage, type OpenWorkOrderRow } from "@/app/(app)/dashboard/actions";
import { Spinner } from "@/components/dashboard/skeletons";

const PAGE_SIZES = [5, 10, 15, 25, 50] as const;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Owns its own page/pageSize state and re-fetches only itself via a server
 * action — deliberately not URL query params + a full page navigation,
 * which would re-run every other dashboard section's query just to change
 * this one table. initialWorkOrders/initialTotal come from the server
 * component that first rendered this (page 1, 5 per page) so the first
 * paint needs no client-side fetch at all.
 */
export function OpenWorkOrdersTable({
  initialWorkOrders,
  initialTotal,
  agingDays,
}: {
  initialWorkOrders: OpenWorkOrderRow[];
  initialTotal: number;
  agingDays: number;
}) {
  const [workOrders, setWorkOrders] = useState(initialWorkOrders);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [pending, startTransition] = useTransition();
  const now = getNow();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goTo(nextPage: number, nextPageSize: number) {
    startTransition(async () => {
      const result = await fetchOpenWorkOrdersPage(nextPage, nextPageSize);
      setWorkOrders(result.workOrders);
      setTotal(result.total);
      setPage(nextPage);
      setPageSize(nextPageSize);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5 text-[11px]">
        <span className="font-semibold" style={{ color: "var(--text-muted)" }}>
          Per page:
        </span>
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            disabled={pending}
            onClick={() => goTo(1, size)}
            className="px-2 py-0.5 rounded-md font-bold disabled:opacity-60"
            style={
              size === pageSize
                ? { background: "var(--color-brand-600)", color: "#fff" }
                : { background: "var(--bg-surface-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
            }
          >
            {size}
          </button>
        ))}
        {pending && <Spinner className="w-3.5 h-3.5 ml-1" />}
      </div>

      <div className="dt-container" style={{ opacity: pending ? 0.6 : 1, transition: "opacity 120ms" }}>
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
                const isAging = status === "readyForPickup" && wo.readyForPickupAt && (now - new Date(wo.readyForPickupAt).getTime()) / 86400000 > agingDays;
                return (
                  <tr key={wo.id} className="dt-row">
                    <td className="dt-td">
                      <Link href={`/work-orders/${wo.id}`} className="font-bold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
                        {wo.customerName}
                      </Link>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {wo.customerContact}
                      </div>
                    </td>
                    <td className="dt-td text-sm">{wo.equipmentLabel}</td>
                    <td className="dt-td">
                      <span className={`dt-badge dt-badge--${isAging ? "error" : WO_STATUS_BADGE[status]}`}>
                        <span className="dt-badge-dot" />
                        {isAging ? `Ready · ${Math.floor((now - new Date(wo.readyForPickupAt!).getTime()) / 86400000)}d` : WO_STATUS_LABELS[status]}
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

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>
          {total === 0 ? "No open work orders" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || page <= 1}
            onClick={() => goTo(page - 1, pageSize)}
            className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            ← Prev
          </button>
          <span className="font-semibold">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={pending || page >= totalPages}
            onClick={() => goTo(page + 1, pageSize)}
            className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
