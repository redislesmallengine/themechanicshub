"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoice, previewInvoiceEmail, markInvoicePaid, voidInvoice, closeInvoiceWorkOrders, saveCustomerEmailForInvoice } from "@/app/(app)/invoices/actions";
import { PAYMENT_METHODS } from "@/lib/invoices";
import { EmailSentNotice } from "@/components/email-sent-notice";
import { MarkInvoiceSentButton } from "@/components/mark-invoice-sent-button";
import { SendWhatsAppButton } from "@/components/send-whatsapp-button";
import { CloseJobAction } from "@/components/close-job-dialog";

const inputStyle = {
  background: "var(--bg-surface-subtle)",
  border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

type ActionResult = { success?: boolean; error?: string } | undefined;

function SendForm({ invoiceId, isResend, isPaid }: { invoiceId: string; isResend: boolean; isPaid: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; replyTo: string | null; to: string | null } | null>(null);
  const [sent, setSent] = useState<{ to: string | null } | null>(null);
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
      setPreview({ subject: result.subject, html: result.html, replyTo: result.replyTo ?? null, to: result.to ?? null });
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
      // Show the confirmation first; the page behind refreshes when it is closed.
      setSent({ to: preview?.to ?? null });
    });
  }

  function handleCloseSent() {
    setSent(null);
    setPreview(null);
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handlePreview} disabled={pendingPreview} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pendingPreview ? "Loading preview…" : isPaid ? "Preview and send the receipt" : isResend ? "Preview and send it again" : "Preview and send the email"}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}

      {sent && <EmailSentNotice title={isPaid ? "Receipt sent" : "Invoice sent"} to={sent.to} onClose={handleCloseSent} />}

      {preview && !sent && (
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

function MarkPaidForm({ invoiceId, awaitingPickupCount }: { invoiceId: string; awaitingPickupCount: number }) {
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
      {awaitingPickupCount > 0 && (
        <label className="flex items-start gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" name="closeWorkOrder" defaultChecked className="mt-0.5" />
          <span>
            Customer picked up the machine{awaitingPickupCount > 1 ? "s" : ""} — close the work order{awaitingPickupCount > 1 ? "s" : ""}
            <span className="block font-normal text-[10px]" style={{ color: "var(--text-muted)" }}>
              Untick if they&apos;re paying now but collecting later.
            </span>
          </span>
        </label>
      )}
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

/** Paid but the machine hasn't gone out yet: one big button to record the pickup without leaving the invoice. */
function PickupAction({ invoiceId, count }: { invoiceId: string; count: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await closeInvoiceWorkOrders(invoiceId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending} className="px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : count > 1 ? "The customer picked them up" : "The customer picked it up"}
      </button>
      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** No email on file: type one here, save it to the customer, and the email option switches on. */
function AddEmailForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveCustomerEmailForInvoice(invoiceId, email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <label className="flex-1 min-w-[12rem] text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
        This customer has no email yet. Type it here to email the invoice.
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 w-full px-3 py-2 rounded-lg text-xs font-medium" style={inputStyle} />
      </label>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save email"}
      </button>
      {error && (
        <p className="w-full text-xs font-semibold" style={{ color: "var(--color-error-solid)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export interface InvoiceSendInfo {
  customerName: string | null;
  customerPhone: string | null;
  invoiceNumber: string;
  shopName: string;
  shareUrl: string;
  pdfHref: string;
}

const optionBox = { background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" };

/** Every way to get the invoice to the customer, in one place: email, WhatsApp, the PDF, or "I handed it over". */
function SendChooser({ invoiceId, status, isWarranty, hasRecipient, hasRecipientEmail, send }: { invoiceId: string; status: string; isWarranty: boolean; hasRecipient: boolean; hasRecipientEmail: boolean; send: InvoiceSendInfo }) {
  const isDraft = status === "draft";
  const isPaid = status === "paid";
  return (
    <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)" }}>
      <div className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
        {isPaid ? "Send a receipt" : "How do you want to send it?"}
      </div>
      <div className="rounded-lg p-3 space-y-2" style={optionBox}>
        <div className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          Email
        </div>
        {hasRecipientEmail ? (
          <SendForm invoiceId={invoiceId} isResend={!isDraft} isPaid={isPaid} />
        ) : isWarranty ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {hasRecipient ? "This warranty provider has no billing email. Add one under Warranty providers in Settings." : "No warranty provider is attached to this invoice yet, so there is nothing to email."}
          </p>
        ) : hasRecipient ? (
          <AddEmailForm invoiceId={invoiceId} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No customer is attached to this invoice, so there is nothing to email.
          </p>
        )}
      </div>
      {!isWarranty && (
        <div className="rounded-lg p-3 space-y-2" style={optionBox}>
          <div className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
            WhatsApp
          </div>
          <SendWhatsAppButton initialPhone={send.customerPhone} customerName={send.customerName} invoiceNumber={send.invoiceNumber} shopName={send.shopName} shareUrl={send.shareUrl} />
        </div>
      )}
      <div className="rounded-lg p-3 space-y-2" style={optionBox}>
        <div className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          Print or hand it over
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={send.pdfHref} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
            Download PDF
          </a>
          {isDraft && <MarkInvoiceSentButton invoiceId={invoiceId} warranty={isWarranty} className="text-xs font-bold text-brand-600 disabled:opacity-60" label={isWarranty ? "I submitted it another way" : "I handed it over or sent it another way"} />}
        </div>
      </div>
    </div>
  );
}

/**
 * The invoice, with the one thing to do next as the big button: Draft -> Send invoice, Sent -> Record payment,
 * Paid -> The customer picked it up. Everything else (resend, the other ways to settle up, voiding) is a quiet
 * link under it, so the page never shows three competing buttons.
 */
export function InvoiceStatusPanel({
  invoiceId,
  status,
  isWarranty,
  hasRecipient,
  hasRecipientEmail,
  canVoid,
  awaitingPickupCount,
  send,
  closeableWorkOrderId = null,
}: {
  invoiceId: string;
  status: string;
  isWarranty: boolean;
  hasRecipient: boolean;
  hasRecipientEmail: boolean;
  canVoid: boolean;
  /** Linked work orders still sitting at Ready. */
  awaitingPickupCount: number;
  send: InvoiceSendInfo;
  /** A single job that is Ready and not yet picked up, so an unpaid invoice can still record the pickup. */
  closeableWorkOrderId?: string | null;
}) {
  const [chooser, setChooser] = useState(false);
  const [paying, setPaying] = useState(false);
  const open = status === "draft" || status === "sent" || status === "viewed";
  const big = "px-5 py-3 rounded-lg text-sm font-extrabold bg-brand-600 hover:bg-brand-700 text-white";
  const link = "text-xs font-bold text-brand-600 text-left";

  return (
    <div className="space-y-3">
      {status === "draft" && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          This invoice has not gone to the customer yet.
        </p>
      )}
      {(status === "sent" || status === "viewed") && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Sent to the customer and not paid yet.
        </p>
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

      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
        {status === "draft" && (
          <button type="button" onClick={() => setChooser((v) => !v)} className={big}>
            Send invoice
          </button>
        )}
        {(status === "sent" || status === "viewed") && (
          <button type="button" onClick={() => setPaying((v) => !v)} className={big}>
            Record payment
          </button>
        )}
        {status === "paid" && awaitingPickupCount > 0 && <PickupAction invoiceId={invoiceId} count={awaitingPickupCount} />}
        {status === "draft" && (
          <button type="button" onClick={() => setPaying((v) => !v)} className={link}>
            The customer already paid
          </button>
        )}
        {(status === "sent" || status === "viewed" || status === "paid") && (
          <button type="button" onClick={() => setChooser((v) => !v)} className={link}>
            {status === "paid" ? "Send a receipt" : "Send it again"}
          </button>
        )}
        {open && closeableWorkOrderId && awaitingPickupCount > 0 && <CloseJobAction workOrderId={closeableWorkOrderId} draftInvoiceId={status === "draft" ? invoiceId : null} label="The customer picked it up (invoice stays open)" variant="link" />}
      </div>

      {chooser && status !== "void" && <SendChooser invoiceId={invoiceId} status={status} isWarranty={isWarranty} hasRecipient={hasRecipient} hasRecipientEmail={hasRecipientEmail} send={send} />}
      {paying && open && <MarkPaidForm invoiceId={invoiceId} awaitingPickupCount={awaitingPickupCount} />}

      {open && canVoid && (
        <details>
          <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--text-muted)" }}>
            Void this invoice
          </summary>
          <div className="mt-2">
            <VoidForm invoiceId={invoiceId} />
          </div>
        </details>
      )}
    </div>
  );
}
