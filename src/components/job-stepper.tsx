"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeWorkOrderStatus } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { moveTargets, STATUS_LABELS, STEP_ROW, stepIndex, type StepTarget, type WorkOrderStatus } from "@/lib/work-orders";

/**
 * The seven steps across the top of a job. Green steps are done and can be clicked to go back to them (the
 * undo bar then offers to reverse it); the blue one is where the job is now; grey ones are still ahead.
 */
export function JobStepper({ workOrderId, status, hasEstimate, hasInvoice, repairFinished }: { workOrderId: string; status: WorkOrderStatus; hasEstimate: boolean; hasInvoice: boolean; repairFinished: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = stepIndex(status, repairFinished);
  const allowed = new Set<StepTarget>(moveTargets(status, hasEstimate, hasInvoice));
  const declined = status === "declined";
  // Billing is Repairing with the repair finished: from Billing, Repairing is one step back; to Billing needs no invoice yet.
  if (status === "inRepair" && repairFinished) allowed.add("inRepair");
  if (!hasInvoice) allowed.add("billing");
  const canClick = (step: { target: StepTarget }, i: number) => i < current && allowed.has(step.target) && (!declined || i <= 3);
  const anyClickable = STEP_ROW.some((step, i) => canClick(step, i));

  function goBack(target: StepTarget) {
    setError(null);
    startTransition(async () => {
      const result = await changeWorkOrderStatus(workOrderId, target);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result.previous) offerUndo(workOrderId, `Moved back to ${STEP_ROW.find((s) => s.target === target)?.label ?? STATUS_LABELS[target as WorkOrderStatus]}`, result.previous);
      router.refresh();
    });
  }

  return (
    <div>
      <ol className="relative grid grid-cols-7 gap-1" aria-label="Where this job is">
        {/* the track behind the dots, filled up to the current step */}
        <span aria-hidden className="absolute top-[13px] h-0.5 rounded" style={{ left: "calc(100% / 14)", right: "calc(100% / 14)", background: "var(--border-strong)" }} />
        <span aria-hidden className="absolute top-[13px] h-0.5 rounded" style={{ left: "calc(100% / 14)", width: `calc((100% - 100% / 7) * ${current / (STEP_ROW.length - 1)})`, background: "var(--color-success-solid)" }} />
        {STEP_ROW.map((step, i) => {
          const done = i < current;
          const now = i === current;
          // A done step is clickable when the job can really go back there (a declined job can reopen only as far as Repairing).
          const clickable = done && canClick(step, i);
          const label = now && declined ? STATUS_LABELS.declined : step.label;
          const stepClickable = clickable;
          const dot = (
            <span
              className="relative z-10 grid place-items-center w-7 h-7 rounded-full text-xs font-extrabold"
              style={
                done
                  ? { background: "var(--color-success-solid)", color: "#fff", border: "2px solid var(--color-success-solid)" }
                  : now
                    ? { background: "var(--bg-surface)", color: declined ? "var(--color-error-solid)" : "var(--color-brand-600)", border: `2px solid ${declined ? "var(--color-error-solid)" : "var(--color-brand-600)"}`, boxShadow: `0 0 0 4px ${declined ? "var(--color-error-subtle)" : "var(--color-info-subtle)"}` }
                    : { background: "var(--bg-surface)", color: "var(--text-muted)", border: "2px solid var(--border-strong)" }
              }
            >
              {done ? "✓" : now && declined ? "×" : i + 1}
            </span>
          );
          const text = (
            <span className={`text-[11px] sm:text-xs font-bold text-center leading-tight${stepClickable ? " underline decoration-dotted underline-offset-4" : ""}`} style={{ color: done ? "var(--color-success-solid)" : now ? (declined ? "var(--color-error-solid)" : "var(--color-brand-600)") : "var(--text-muted)" }}>
              {label}
            </span>
          );
          return (
            <li key={step.target} className="flex" aria-current={now ? "step" : undefined}>
              {clickable ? (
                <button type="button" onClick={() => goBack(step.target)} disabled={pending} title={`Go back to ${step.label}`} className="job-step-link w-full flex flex-col items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60">
                  {dot}
                  {text}
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-1.5">
                  {dot}
                  {text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] mt-2" style={{ color: error ? "var(--color-error-solid)" : "var(--text-muted)" }}>
        {error ?? (anyClickable ? "Changed your mind? Click an underlined green step to go back to it." : "The blue step is where this job is now.")}
      </p>
    </div>
  );
}
