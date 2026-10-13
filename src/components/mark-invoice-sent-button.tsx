"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markInvoiceSent } from "@/app/(app)/invoices/actions";

/** One click to move a draft invoice to Sent / Submitted without emailing it (handed over, sent on WhatsApp, or filed with a manufacturer). */
export function MarkInvoiceSentButton({ invoiceId, warranty = false, className, label }: { invoiceId: string; warranty?: boolean; className?: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const result = await markInvoiceSent(invoiceId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={className ?? "px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60 whitespace-nowrap"}
      >
        {pending ? "Saving…" : (label ?? (warranty ? "Mark as submitted" : "Mark as sent"))}
      </button>
      {error && (
        <span className="block text-[11px] font-semibold mt-1" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
