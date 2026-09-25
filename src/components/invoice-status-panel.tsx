"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoice, previewInvoiceEmail, markInvoicePaid, voidInvoice } from "@/app/(app)/invoices/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

function SendForm({ invoiceId, hasCustomer, hasCustomerEmail, isResend, isPaid }: { invoiceId: string; hasCustomer: boolean; hasCustomerEmail: boolean; isResend: boolean; isPaid: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; replyTo: string | null } | null>(null);
  const [pendingPreview, startPreview] = useTransition();
  const [pendingSend, startSend] = useTransition();

  function handlePreview() {
    setError(null);
    startPreview(async () => {
      const result = await previewInvoiceEmail(invoiceId);
      if (result?.error || !result.subject || !result.html) {
        setError(result?.error ?? "Couldn't load the preview.");
        return;
      }
      setPreview({ subject: result.subject, html: result.html, replyTo: result.replyTo ?? null });
    });
  }

  function handleConfirmSend() {
    setError(null);
    startSend(async () => {
      const result: ActionResult = await sendInvoice(invoiceId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {!hasCustomerEmail && (
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-warning-solid)" }}>
          {hasCustomer
            ? "This customer has no email on file — add one before you can send this invoice."
            : "This invoice has no customer attached — nothing to email it to. Download the PDF instead, or hand it over in person."}
        </p>
      )}
      <button onClick={handlePreview} disabled={pendingPreview || !hasCustomerEmail} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pendingPreview ? "Loading Preview…" : isPaid ? "Preview & Send Receipt" : isResend ? "Preview & Resend" : "Preview Email"}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-5xl h-[90vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {preview.subject}
              </h3>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                {isPaid
                  ? "Exactly what will be sent — a paid receipt, PDF attached. This is the real link the customer will use to view it."
                  : "Exactly what will be sent, PDF attached — this is the real view/pay link the customer will use."}
                {preview.replyTo && (
                  <>
                    {" "}
                    Replies go to <b>{preview.replyTo}</b>.
                  </>
                )}
              </p>
              {isResend && !isPaid && (
                <p className="text-[10px] mt-1 font-semibold" style={{ color: "var(--color-warning-solid)" }}>
                  This invoice was already sent — this will send it again.
                </p>
              )}
            </div>
            <iframe title="Invoice email preview" srcDoc={preview.html} sandbox="" className="flex-1 min-h-0 w-full bg-white" />
            <div className="p-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button type="button" onClick={handleConfirmSend} disabled={pendingSend} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
                {pendingSend ? "Sending…" : isPaid ? "Send Receipt" : isResend ? "Confirm & Resend" : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = markInvoicePaid.bind(null, invoiceId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="paymentMethod" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Payment Method
          </label>
          <select id="paymentMethod" name="paymentMethod" required defaultValue="" className="w-full px-3 py-2 rounded-lg text-xs font-semibold" style={inputStyle}>
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
          <label htmlFor="paymentReference" className="block font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
            Reference (optional)
          </label>
          <input id="paymentReference" name="paymentReference" type="text" placeholder="e-transfer confirmation #, etc." className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
        </div>
      </div>
      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : "Mark as Paid"}
      </button>
    </form>
  );
}

function VoidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bound = voidInvoice.bind(null, invoiceId);

  function handleSubmit(formData: FormData) {
    if (!confirm("Void this invoice? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await bound(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-2 flex-wrap pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="flex-1 min-w-[220px]">
        <label htmlFor="voidReason" className="block font-bold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Void Reason
        </label>
        <input id="voidReason" name="voidReason" type="text" required placeholder="Why this invoice is being voided" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </div>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--color-error-solid)" }}>
        {pending ? "Voiding…" : "Void Invoice"}
      </button>
      {error && (
        <p className="text-xs font-semibold w-full" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export function InvoiceStatusPanel({
  invoiceId,
  status,
  hasCustomer,
  hasCustomerEmail,
  canVoid,
}: {
  invoiceId: string;
  status: string;
  hasCustomer: boolean;
  hasCustomerEmail: boolean;
  canVoid: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Sendable at any status except Void — including Paid, so a shop can hand over a fresh copy after the fact (lost the email, wants it for their records). sendInvoice itself only ever advances status forward from Draft, never backward on a resend. */}
      {status !== "void" && <SendForm invoiceId={invoiceId} hasCustomer={hasCustomer} hasCustomerEmail={hasCustomerEmail} isResend={status !== "draft"} isPaid={status === "paid"} />}
      {/* Draft is included here too, not just Sent/Viewed — a walk-in cash sale with no customer to email needs a way to close out that doesn't go through Send Invoice at all. */}
      {(status === "draft" || status === "sent" || status === "viewed") && (
        <>
          <MarkPaidForm invoiceId={invoiceId} />
          {canVoid && <VoidForm invoiceId={invoiceId} />}
        </>
      )}
      {status === "paid" && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-success-solid)" }}>
          Paid.
        </p>
      )}
      {status === "void" && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          Voided.
        </p>
      )}
    </div>
  );
}
