"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceDetails } from "@/app/(app)/invoices/actions";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

export function InvoiceDetailsForm({ invoiceId, initialDueDate, initialNotes }: { invoiceId: string; initialDueDate: string; initialNotes: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = updateInvoiceDetails.bind(null, invoiceId);

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
          <label htmlFor="dueDate" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Due Date
          </label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={initialDueDate} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="notes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={initialNotes}
            placeholder="Shown on the invoice"
            className="w-full px-3 py-2 rounded-lg text-xs font-medium resize-y"
            style={inputStyle}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <span className="text-[11px] font-semibold" style={{ color: message.type === "error" ? "var(--color-error-solid)" : "var(--color-success-solid)" }}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
