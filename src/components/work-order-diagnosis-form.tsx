"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDiagnosis } from "@/app/(app)/work-orders/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function WorkOrderDiagnosisForm({
  workOrderId,
  members,
  initialDiagnosisNotes,
  initialLaborHours,
  initialAssignedToUserId,
}: {
  workOrderId: string;
  members: { userId: string; name: string }[];
  initialDiagnosisNotes: string;
  initialLaborHours: string;
  initialAssignedToUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = updateDiagnosis.bind(null, workOrderId);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Saved." });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
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
          <label htmlFor="laborHours" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Labor Hours
          </label>
          <input id="laborHours" name="laborHours" type="number" step="0.25" min="0" defaultValue={initialLaborHours} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="diagnosisNotes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Diagnosis Notes
          </label>
          <textarea id="diagnosisNotes" name="diagnosisNotes" rows={3} defaultValue={initialDiagnosisNotes} placeholder="What you found" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>
      {message && (
        <p className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save Diagnosis"}
      </button>
    </form>
  );
}
