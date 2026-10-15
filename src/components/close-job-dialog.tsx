"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeWorkOrder } from "@/app/(app)/work-orders/actions";
import { markInvoiceSent } from "@/app/(app)/invoices/actions";
import { offerUndo } from "@/lib/job-undo";

/**
 * Asks before marking a job picked up when its invoice is still a draft, with "also mark the invoice
 * as sent / submitted" already ticked -- so a job can't be closed with its invoice quietly left behind.
 */
export function CloseJobDialog({ workOrderId, draftInvoiceId, onClose }: { workOrderId: string; draftInvoiceId: string; onClose: () => void }) {
  const router = useRouter();
  const [alsoSend, setAlsoSend] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      if (alsoSend) {
        const sent = await markInvoiceSent(draftInvoiceId);
        if (sent?.error) {
          setError(sent.error);
          return;
        }
      }
      const closed = await closeWorkOrder(workOrderId);
      if (closed?.error) {
        setError(closed.error);
        return;
      }
      offerUndo(workOrderId, "Marked done, picked up", closed.previous);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mark this job picked up"
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
          Mark this job picked up?
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Its invoice is still a draft.
        </p>
        <label className="flex items-start gap-2 text-sm font-semibold mb-4 cursor-pointer" style={{ color: "var(--text-primary)" }}>
          <input type="checkbox" checked={alsoSend} onChange={(e) => setAlsoSend(e.target.checked)} className="mt-0.5" style={{ accentColor: "#0F52BA" }} />
          Also mark the invoice as sent / submitted
        </label>
        {error && (
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={confirm} disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
            {pending ? "Saving…" : "Picked up"}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Mark Picked Up / Delivered" -- closes straight away, unless the invoice is still a draft, in which case it asks first. */
export function CloseJobAction({ workOrderId, draftInvoiceId, label = "Mark Picked Up / Delivered", variant = "button" }: { workOrderId: string; draftInvoiceId: string | null; label?: string; variant?: "button" | "link" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (draftInvoiceId) {
      setOpen(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await closeWorkOrder(workOrderId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      offerUndo(workOrderId, "Marked done, picked up", result.previous);
      router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending} className={variant === "link" ? "text-xs font-bold text-brand-600 text-left disabled:opacity-60" : "px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"}>
        {pending ? "Working…" : label}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      {open && draftInvoiceId && <CloseJobDialog workOrderId={workOrderId} draftInvoiceId={draftInvoiceId} onClose={() => setOpen(false)} />}
    </div>
  );
}
