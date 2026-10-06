"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRepairNotes } from "@/app/(app)/work-orders/actions";

/** "Work performed" -- how it was fixed. Plain onSubmit (not <form action>) so the text isn't reset after saving. */
export function WorkOrderRepairNotesForm({ workOrderId, initialNotes }: { workOrderId: string; initialNotes: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = updateRepairNotes.bind(null, workOrderId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        id="repairNotes"
        name="repairNotes"
        rows={5}
        defaultValue={initialNotes}
        placeholder="What was done — parts replaced, adjustments, test results. This starts out as the invoice notes."
        className="w-full px-3 py-2 rounded-lg text-xs font-medium"
        style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save Work Performed"}
        </button>
        {message && (
          <span className="text-xs font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
