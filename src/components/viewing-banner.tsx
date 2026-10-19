"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changeWorkOrderStatus } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { secondaryButton } from "@/lib/ui";

/**
 * Shown on top of an earlier step that is only being looked at. One button comes back to where the job is; the other
 * (when allowed) really moves the job back to that step, for the rare case of redoing it, with the Undo bar after.
 */
export function ViewingBanner({
  workOrderId,
  viewingLabel,
  viewingTarget,
  currentLabel,
  canMoveBack,
  warnsAboutApproval,
}: {
  workOrderId: string;
  viewingLabel: string;
  viewingTarget: string;
  currentLabel: string;
  canMoveBack: boolean;
  /** Moving back this far asks the customer for their go-ahead again. */
  warnsAboutApproval: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const home = `/work-orders/${workOrderId}`;

  function moveBack() {
    const extra = warnsAboutApproval ? " The customer's earlier go-ahead is cleared and will be asked for again." : "";
    if (!confirm(`Move this job back to ${viewingLabel}?${extra} You can undo it for a few seconds afterwards.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await changeWorkOrderStatus(workOrderId, viewingTarget);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result.previous) offerUndo(workOrderId, `Moved back to ${viewingLabel}`, result.previous);
      router.push(home);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl px-5 py-4 space-y-2" style={{ background: "var(--color-info-subtle)", border: "2px solid var(--text-primary)" }} role="status">
      <p className="text-lg font-extrabold">
        You are looking at {viewingLabel}. The job is still on {currentLabel}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={home} className="px-5 py-2.5 rounded-xl text-lg font-extrabold bg-brand-600 hover:bg-brand-700 text-white">
          Back to {currentLabel}
        </Link>
        {canMoveBack && (
          <button type="button" onClick={moveBack} disabled={pending} className={secondaryButton}>
            {pending ? "Moving…" : `Redo from here: move the job back to ${viewingLabel}`}
          </button>
        )}
      </div>
      {error && (
        <p className="text-base font-bold" style={{ color: "var(--color-error-solid)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
