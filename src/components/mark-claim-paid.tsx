"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markInvoicePaid } from "@/app/(app)/invoices/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";

/** Records the manufacturer's payment on a submitted claim: how it was paid, then one click. */
export function MarkClaimPaid({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!method) {
      setError("Choose how it was paid.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("paymentMethod", method);
    startTransition(async () => {
      const result = await markInvoicePaid(invoiceId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <select
          aria-label="How was it paid?"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="px-1.5 py-1 rounded-md text-[11px] font-semibold"
          style={{ background: "var(--bg-surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <option value="">Paid by…</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleClick} disabled={pending} className="px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Mark paid"}
        </button>
      </div>
      {error && (
        <span className="text-[11px] font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
