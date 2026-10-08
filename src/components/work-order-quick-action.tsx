"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDiagnosis, startRepair, markReadyForPickup } from "@/app/(app)/work-orders/actions";

type ActionResult = { success?: boolean; error?: string } | undefined;

/**
 * The Work Orders list's "Next step" for the stages where the step is just a click
 * (Pending -> Diagnosing -> In Repair -> Repair Completed): it runs in place, so the
 * owner never has to open the job. Steps that need decisions (an estimate, invoice
 * fees) stay links to the job page.
 */
export function WorkOrderQuickAction({ workOrderId, status }: { workOrderId: string; status: "droppedOff" | "diagnosing" | "inRepair" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const step: { label: string; run: () => Promise<ActionResult> } =
    status === "droppedOff"
      ? { label: "Start diagnosis", run: () => startDiagnosis(workOrderId) }
      : status === "diagnosing"
        ? { label: "Start repair", run: () => startRepair(workOrderId) }
        : { label: "Mark complete", run: () => markReadyForPickup(workOrderId) };

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await step.run();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
      >
        {pending ? "Working…" : `${step.label} →`}
      </button>
      {error && (
        <p className="text-[11px] font-semibold mt-1 max-w-[14rem]" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
