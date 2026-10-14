"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendEstimate, previewEstimateEmail } from "@/app/(app)/work-orders/actions";
import { EmailSentNotice } from "@/components/email-sent-notice";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

/**
 * The written estimate: an amount and a plain-language line, a preview of the exact email, and a
 * confirm. Sits inside the Diagnosing card; "What it covers" starts from the diagnosis so there is
 * nothing to type twice.
 */
export function EstimateForm({
  workOrderId,
  hasCustomerEmail,
  defaultNotes = "",
  onBack,
}: {
  workOrderId: string;
  hasCustomerEmail: boolean;
  defaultNotes?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; to: string | null } | null>(null);
  const [sent, setSent] = useState<{ to: string | null } | null>(null);
  const [pendingPreview, startPreview] = useTransition();
  const [pendingSend, startSend] = useTransition();
  const boundPreview = previewEstimateEmail.bind(null, workOrderId);
  const boundSend = sendEstimate.bind(null, workOrderId);

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startPreview(async () => {
      const result = await boundPreview(formData);
      if (result?.error || !result.subject || !result.html) {
        setError(result?.error ?? "Couldn't load the preview.");
        return;
      }
      setPreview({ subject: result.subject, html: result.html, to: result.to ?? null });
    });
  }

  function handleConfirmSend() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startSend(async () => {
      const result = await boundSend(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Show the confirmation first -- refreshing right away would move the job on and tear this
      // whole form (and popup) down with no sign the email went out.
      setSent({ to: preview?.to ?? null });
    });
  }

  function handleCloseSent() {
    setSent(null);
    setPreview(null);
    router.refresh();
  }

  return (
    <>
      <form ref={formRef} onSubmit={handlePreview} className="space-y-3">
        {!hasCustomerEmail && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-warning-solid)" }}>
            This customer has no email on file, so sending will fail. If they have already said yes, start the repair instead.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor="estimateAmount" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              Estimate amount ($)
            </label>
            <input id="estimateAmount" name="estimateAmount" type="number" step="0.01" min="0" required inputMode="decimal" className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="estimateNotes" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
              What it covers
            </label>
            <textarea
              id="estimateNotes"
              name="estimateNotes"
              required
              rows={4}
              defaultValue={defaultNotes}
              placeholder="Plain language. This is what the customer sees."
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={inputStyle}
            />
          </div>
        </div>
        {error && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
            {error}
          </p>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <button type="submit" disabled={pendingPreview} className="px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
            {pendingPreview ? "Loading preview…" : "Review and send estimate"}
          </button>
          {onBack && (
            <button type="button" onClick={onBack} className="text-xs font-bold text-brand-600">
              Back
            </button>
          )}
        </div>
      </form>

      {sent && <EmailSentNotice title="Estimate sent" to={sent.to} detail="The job now says Waiting on customer." onClose={handleCloseSent} />}

      {preview && !sent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {preview.subject}
              </h3>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                This is exactly what will be sent, except the approval link below. Its real, unique code is generated only when you actually send.
              </p>
            </div>
            <iframe title="Estimate email preview" srcDoc={preview.html} sandbox="" className="flex-1 w-full bg-white" />
            <div className="p-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              {error && (
                <p className="text-xs font-semibold mr-auto" style={{ color: "var(--color-error-solid)" }}>
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Edit
              </button>
              <button type="button" onClick={handleConfirmSend} disabled={pendingSend} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
                {pendingSend ? "Sending…" : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
