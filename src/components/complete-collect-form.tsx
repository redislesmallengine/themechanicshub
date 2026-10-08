"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeAndCollect } from "@/app/(app)/invoices/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

/**
 * Counter job, customer standing there: finish the repair, bill it, take payment and
 * close the work order from one panel. Parts are managed in the Parts Needed card; this
 * panel lists what will be billed so nothing is a surprise.
 */
export function CompleteCollectForm({
  workOrderId,
  initialRepairNotes,
  notesPrefilledFromDiagnosis,
  initialLabourHours,
  parts,
  hasDiagnosticFee,
  showDeliveryFee,
  deliveryFeeDefault,
  customerEmail,
}: {
  workOrderId: string;
  initialRepairNotes: string;
  notesPrefilledFromDiagnosis: boolean;
  initialLabourHours: string;
  parts: { name: string; quantity: number }[];
  hasDiagnosticFee: boolean;
  showDeliveryFee: boolean;
  deliveryFeeDefault: string;
  customerEmail: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emailProblem, setEmailProblem] = useState<{ invoiceId: string; message: string } | null>(null);
  const [includeDelivery, setIncludeDelivery] = useState(showDeliveryFee);
  const [pending, startTransition] = useTransition();
  const bound = completeAndCollect.bind(null, workOrderId);

  // onSubmit, not <form action>: React 19 resets the fields after an action finishes, and a failed
  // attempt (say a missing payment method) must not wipe what was typed.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setEmailProblem(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success && result.emailError) {
        setEmailProblem({ invoiceId: result.invoiceId, message: result.emailError });
        return;
      }
      if (result?.success) router.push(`/invoices/${result.invoiceId}`);
    });
  }

  if (emailProblem) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-success-solid)" }}>
          Done — repair completed, invoice created, paid and closed.
        </p>
        <p className="text-xs font-semibold" style={{ color: "var(--color-warning-solid)" }}>
          The receipt email wasn&apos;t sent: {emailProblem.message}
        </p>
        <Link href={`/invoices/${emailProblem.invoiceId}`} className="inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white">
          Open the invoice
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="cc-repairNotes" className="block text-xs font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
          Work performed
        </label>
        <textarea
          id="cc-repairNotes"
          name="repairNotes"
          rows={3}
          defaultValue={initialRepairNotes}
          placeholder="What was done — parts replaced, adjustments, test results. This goes on the invoice."
          className="w-full px-3 py-2 rounded-lg text-xs font-medium"
          style={inputStyle}
        />
        {notesPrefilledFromDiagnosis && (
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Pre-filled from the diagnosis — edit it to say what was actually done.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label htmlFor="cc-labourHours" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Labour hours
          </label>
          <input id="cc-labourHours" name="labourHours" type="number" step="0.25" min="0" defaultValue={initialLabourHours} className="w-full px-3 py-2 rounded-lg text-xs font-mono" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="cc-paymentMethod" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Payment method
          </label>
          <select id="cc-paymentMethod" name="paymentMethod" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
            <option value="" disabled>
              Select…
            </option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cc-paymentReference" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reference (optional)
          </label>
          <input id="cc-paymentReference" name="paymentReference" type="text" placeholder="e-transfer #, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>

      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="font-bold">Parts on this job: </span>
        {parts.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>none — add any in the Parts Needed card below before collecting.</span>
        ) : (
          parts.map((p) => `${p.name} × ${p.quantity}`).join(", ")
        )}
      </div>

      {(hasDiagnosticFee || showDeliveryFee) && (
        <div className="space-y-1.5">
          {hasDiagnosticFee && (
            <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" name="includeDiagnosticFee" defaultChecked className="rounded" style={{ accentColor: "#0F52BA" }} />
              Include diagnostic fee
            </label>
          )}
          {showDeliveryFee && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" name="includeDeliveryFee" checked={includeDelivery} onChange={(e) => setIncludeDelivery(e.target.checked)} className="rounded" style={{ accentColor: "#0F52BA" }} />
                Include pickup/delivery fee
              </label>
              {includeDelivery && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-5">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    $
                  </span>
                  <input
                    type="number"
                    name="deliveryFeeAmount"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={deliveryFeeDefault}
                    placeholder="0.00"
                    className="w-24 px-2 py-1 rounded-lg text-xs font-mono"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {customerEmail && (
        <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" name="emailReceipt" className="rounded" style={{ accentColor: "#0F52BA" }} />
          Also email a receipt to {customerEmail}
        </label>
      )}

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={pending} className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
          {pending ? "Completing…" : "Complete, Bill & Mark Paid"}
        </button>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Marks the repair complete, creates the invoice, records the payment and closes the job.
        </span>
      </div>
    </form>
  );
}
