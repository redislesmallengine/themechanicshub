"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDiagnosis } from "@/app/(app)/work-orders/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type Outcome = "estimate" | "later" | "repair";

const OUTCOMES: { value: Outcome; label: string; savedText: string }[] = [
  { value: "estimate", label: "Save & send estimate", savedText: "Saved. Fill in the estimate below to send it." },
  { value: "later", label: "Save, repair later", savedText: "Saved — moved to Diagnosing." },
  { value: "repair", label: "Save & start repair", savedText: "Saved — repair started." },
];

export function WorkOrderDiagnosisForm({
  workOrderId,
  status,
  preApprovalRequired,
  members,
  initialDiagnosisNotes,
  initialLabourHours,
  initialAssignedToUserId,
}: {
  workOrderId: string;
  status: string;
  /** The intake answer -- only decides which button is highlighted; null on jobs created before it was recorded. */
  preApprovalRequired: boolean | null;
  members: { userId: string; name: string }[];
  initialDiagnosisNotes: string;
  initialLabourHours: string;
  initialAssignedToUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = updateDiagnosis.bind(null, workOrderId);
  // Pending / Diagnosing: the three outcomes. Anything later: a plain Save.
  const choosing = status === "droppedOff" || status === "diagnosing";
  const recommended: Outcome = preApprovalRequired === true ? "estimate" : preApprovalRequired === false ? "repair" : "later";

  // A plain onSubmit, not <form action>: React 19 resets a form's fields to their
  // original defaults once an action finishes, so the saved value (e.g. the
  // technician) snapped back to the old one on screen until a full refresh.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    const outcome = OUTCOMES.find((o) => o.value === submitter?.value);
    setMessage(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: choosing && outcome ? outcome.savedText : "Saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="assignedToUserId" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Assigned Technician
          </label>
          <select id="assignedToUserId" name="assignedToUserId" defaultValue={initialAssignedToUserId} className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="labourHours" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Labour Hours
          </label>
          <input id="labourHours" name="labourHours" type="number" step="0.25" min="0" defaultValue={initialLabourHours} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="diagnosisNotes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Diagnosis Notes
          </label>
          <textarea id="diagnosisNotes" name="diagnosisNotes" rows={4} defaultValue={initialDiagnosisNotes} placeholder="What you found" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>
      {message && (
        <p className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
          {message.text}
        </p>
      )}
      {choosing ? (
        <div>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="submit"
                name="outcome"
                value={o.value}
                disabled={pending}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                style={
                  o.value === recommended
                    ? { background: "var(--color-brand-600)", color: "#fff", border: "1px solid var(--color-brand-600)" }
                    : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }
                }
              >
                {pending ? "Saving…" : o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            The highlighted button follows the answer given at intake. Saving only a technician moves the job to Diagnosing.
          </p>
        </div>
      ) : (
        <button type="submit" name="outcome" value="save" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save Diagnosis"}
        </button>
      )}
    </form>
  );
}
