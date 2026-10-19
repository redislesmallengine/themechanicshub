"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishRepair } from "@/app/(app)/work-orders/actions";
import { removeWorkOrderPart } from "@/app/(app)/work-orders/actions";
import { offerUndo } from "@/lib/job-undo";
import { AddPartPicker, type AvailablePart } from "@/components/add-part-picker";
import { secondaryButton, dangerButton } from "@/lib/ui";

export interface PartRowData {
  id: string;
  name: string;
  quantity: number;
  unitSellPrice: string | null;
}

function PartRow({ part }: { part: PartRowData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Take ${part.name} off this job? The stock it used will be put back.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeWorkOrderPart(part.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap" style={{ background: "var(--bg-surface)", border: "1.5px solid var(--text-primary)" }}>
      <div className="flex-1 min-w-[12rem]">
        <div className="text-lg font-bold">{part.name}</div>
        {error && (
          <div className="text-sm font-bold" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </div>
        )}
      </div>
      <div className="text-lg font-bold tabular-nums">Qty {part.quantity}</div>
      <div className="text-lg tabular-nums w-40 whitespace-nowrap">{part.unitSellPrice ? `$${part.unitSellPrice} each` : "no price set"}</div>
      <button type="button" onClick={remove} disabled={pending} className={dangerButton}>
        {pending ? "Removing…" : "Remove"}
      </button>
    </div>
  );
}

/**
 * The Repairing step: only the repair. What was done, the parts used on it, and one big "Repair finished" button that moves
 * the job on to Billing. No prices or payment here.
 */
export function RepairStepPanel({
  workOrderId,
  initialRepairNotes,
  notesPrefilledFromDiagnosis,
  parts,
  availableParts,
  returningToBilling = false,
}: {
  workOrderId: string;
  /** Looking at this step from Billing: the button saves and goes back to Billing instead of finishing the repair. */
  returningToBilling?: boolean;
  initialRepairNotes: string;
  notesPrefilledFromDiagnosis: boolean;
  parts: PartRowData[];
  availableParts: AvailablePart[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialRepairNotes);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function finish() {
    setError(null);
    const fd = new FormData();
    fd.set("repairNotes", notes);
    startTransition(async () => {
      const result = await finishRepair(workOrderId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (returningToBilling) {
        router.push(`/work-orders/${workOrderId}`);
        router.refresh();
        return;
      }
      offerUndo(workOrderId, "Repair marked finished", result.previous);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="rp-notes" className="block text-lg font-extrabold mb-1.5">
          What was done
        </label>
        <textarea id="rp-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parts replaced, adjustments, test results. This goes on the invoice." className="w-full px-4 py-3 rounded-xl" />
        {notesPrefilledFromDiagnosis && notes === initialRepairNotes && <p className="text-base mt-1">Started from the diagnosis. Change it to say what was actually done.</p>}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-extrabold">Parts used</h3>
        {parts.length === 0 && <p className="text-base">No parts on this job yet.</p>}
        {parts.map((p) => (
          <PartRow key={p.id} part={p} />
        ))}
        {adding ? (
          <AddPartPicker workOrderId={workOrderId} availableParts={availableParts} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={secondaryButton}>
            + Add a part
          </button>
        )}
      </div>

      {error && (
        <p className="text-base font-bold rounded-lg px-4 py-3" style={{ color: "var(--color-error-solid)", background: "var(--color-error-subtle)", border: "1.5px solid var(--color-error-solid)" }} role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={finish} disabled={pending} className="px-8 py-4 rounded-xl text-xl font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : returningToBilling ? "Save and go back to Billing" : "Repair finished"}
      </button>
    </div>
  );
}
