"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeWorkOrderStatus } from "@/app/(app)/work-orders/actions";
import { STATUS_LABELS, WORK_ORDER_STATUSES, type WorkOrderStatus } from "@/lib/work-orders";

/**
 * "Move to..." -- jump a job straight to any status instead of clicking through each
 * step. Used on the job page and on every row of the Work Orders list. Options that
 * would contradict the job are left out (Awaiting Approval needs an estimate sent;
 * once invoiced a job can't go back before Repair Completed); closing a job that has
 * no invoice asks first.
 */
export function WorkOrderStatusMover({
  workOrderId,
  status,
  hasEstimate,
  hasInvoice,
  compact = false,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
  hasEstimate: boolean;
  hasInvoice: boolean;
  /** Small, label-less version for table rows. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = WORK_ORDER_STATUSES.filter((s) => {
    if (s === status) return false;
    if (s === "awaitingApproval" && !hasEstimate) return false;
    if (hasInvoice && (s === "droppedOff" || s === "diagnosing" || s === "awaitingApproval" || s === "inRepair" || s === "declined")) return false;
    return true;
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const target = e.target.value;
    e.target.value = "";
    if (!target) return;
    if (target === "closed" && !hasInvoice && !confirm("This job has no invoice yet. Mark it picked up / closed anyway?")) return;
    setError(null);
    startTransition(async () => {
      const result = await changeWorkOrderStatus(workOrderId, target);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={compact ? "inline-block" : ""}>
      <select
        aria-label="Move this work order to another status"
        defaultValue=""
        onChange={handleChange}
        disabled={pending}
        className={compact ? "px-1.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-60" : "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"}
        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
      >
        <option value="">{pending ? "Moving…" : "Move to…"}</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[11px] font-semibold mt-1 max-w-[16rem]" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
