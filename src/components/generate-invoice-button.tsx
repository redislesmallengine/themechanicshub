"use client";

import { useState, useTransition } from "react";
import { generateInvoiceFromWorkOrder } from "@/app/(app)/invoices/actions";

export function GenerateInvoiceButton({ workOrderId, hasDiagnosticFee }: { workOrderId: string; hasDiagnosticFee: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = generateInvoiceFromWorkOrder.bind(null, workOrderId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      // generateInvoiceFromWorkOrder redirects on success, so reaching here means it didn't
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {hasDiagnosticFee && (
        <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" name="includeDiagnosticFee" defaultChecked className="rounded" style={{ accentColor: "#0F52BA" }} />
          Include diagnostic fee
        </label>
      )}
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Generating…" : "Generate Invoice"}
      </button>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
